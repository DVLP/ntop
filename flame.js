// source https://github.com/jantimon/cpuprofile-to-flamegraph
/**
 * Convert a cpuprofile into a FlameGraph
 */
function convertToMergedFlameGraph(cpuProfile) {
  const nodes = convertToTimedFlameGraph(cpuProfile)
  // Add all parent nodes
  const parentNodes = nodes.map((node) => {
    const executionTime = node.value
    node = Object.assign({}, node, { children: [], executionTime })
    node.selfTime = node.value
    while (node.parent && node.parent.children) {
      const newParent = Object.assign({}, node.parent, {
        children: [node],
        executionTime,
      })
      node.parent = newParent
      node = newParent
    }
    return node
  })
  const mergedNodes = []
  let currentNode = parentNodes[0]
  // Merge equal parent nodes
  for (let nodeIndex = 1; nodeIndex <= parentNodes.length; nodeIndex++) {
    const nextNode = parentNodes[nodeIndex]
    const isMergeAble = nextNode !== undefined &&
        currentNode.profileNode === nextNode.profileNode &&
        currentNode.children.length &&
        nextNode.children.length
    if (!isMergeAble) {
      mergedNodes.push(currentNode)
      currentNode = nextNode
    }
    else {
      // Find common child
      let currentMergeNode = currentNode
      let nextMergeNode = nextNode
      while (true) {
        // Child nodes are sorted in chronological order
        // as nextNode is executed after currentNode it
        // is only possible to merge into the last child
        const lastChildIndex = currentMergeNode.children.length - 1
        const mergeCandidate1 = currentMergeNode.children[lastChildIndex]
        const mergeCandidate2 = nextMergeNode.children[0]
        // As `getReducedSamples` already reduced all children
        // only nodes with children are possible merge targets
        const nodesHaveChildren = mergeCandidate1.children.length &&
            mergeCandidate2.children.length
        if (nodesHaveChildren && mergeCandidate1.profileNode.id === mergeCandidate2.profileNode.id) {
          currentMergeNode = mergeCandidate1
          nextMergeNode = mergeCandidate2
        } else {
          break
        }
      }
      // Merge the last mergeable node
      currentMergeNode.children.push(nextMergeNode.children[0])
      nextMergeNode.children[0].parent = currentMergeNode
      const additionalExecutionTime = nextMergeNode.executionTime
      let currentExecutionTimeNode = currentMergeNode
      while (currentExecutionTimeNode) {
        currentExecutionTimeNode.executionTime += additionalExecutionTime
        currentExecutionTimeNode = currentExecutionTimeNode.parent
      }
    }
  }
  return mergedNodes[0]
}

function convertToTimedFlameGraph(cpuProfile) {
  // Convert into FrameGraphNodes structure
  const linkedNodes = cpuProfile.nodes.map((node) => ({
    name: node.callFrame.functionName || '(anonymous function)',
    value: 0,
    executionTime: 0,
    children: [],
    profileNode: node,
    nodeModule: node.callFrame.url ? getNodeModuleName(node.callFrame.url) : undefined,
  }))

  // Create a map for id lookups
  const flameGraphNodeById = new Map()
  cpuProfile.nodes.forEach((node, i) => {
    flameGraphNodeById.set(node.id, linkedNodes[i])
  })
  // Create reference to children
  linkedNodes.forEach((linkedNode) => {
    const children = linkedNode.profileNode.children || []
    linkedNode.children = children.map((childNodeId) => flameGraphNodeById.get(childNodeId))
    linkedNode.children.forEach((child) => { child.parent = linkedNode })
  })

  const _a = getReducedSamples(cpuProfile)
  const { reducedSamples, reducedTimeDeltas } = _a
  const timedRootNodes = reducedSamples.map((sampleId, i) => Object.assign({}, flameGraphNodeById.get(sampleId), {
    value: reducedTimeDeltas[i],
  }))
  return timedRootNodes
}
/**
 * If multiple samples in a row are the same they can be
 * combined
 *
 * This function returns a merged version of a cpuProfiles
 * samples and timeDeltas
 */
function getReducedSamples(_a) {
  const { samples, timeDeltas } = _a
  const sampleCount = samples.length
  const reducedSamples = []
  const reducedTimeDeltas = []
  if (sampleCount === 0) {
    return { reducedSamples, reducedTimeDeltas }
  }
  let reducedSampleId = samples[0]
  let reducedTimeDelta = timeDeltas[0]
  for (let i = 1; i <= sampleCount; i++) {
    if (reducedSampleId === samples[i]) {
      reducedTimeDelta += timeDeltas[i]
    } else {
      reducedSamples.push(reducedSampleId)
      reducedTimeDeltas.push(reducedTimeDelta)
      reducedSampleId = samples[i]
      reducedTimeDelta = timeDeltas[i]
    }
  }
  return { reducedSamples, reducedTimeDeltas }
}

/**
 * Extract the node_modules name from a url
 */
function getNodeModuleName(url) {
  const nodeModules = '/node_modules/'
  const nodeModulesPosition = url.lastIndexOf(nodeModules)
  if (nodeModulesPosition === -1) return undefined
  const folderNamePosition = url.indexOf('/', nodeModulesPosition + 1)
  const folderNamePositionEnd = url.indexOf('/', folderNamePosition + 1)
  if (folderNamePosition === -1 || folderNamePositionEnd === -1) return undefined
  return url.substr(folderNamePosition + 1, folderNamePositionEnd - folderNamePosition - 1)
}

module.exports = { convertToMergedFlameGraph }
