#! /usr/bin/env node
const { convertToMergedFlameGraph } = require('./flame.js')
const { exec } = require('child_process')
const ipc = require('node-ipc').default
ipc.config.id = 'ntop'
ipc.config.retry = 1500
ipc.config.silent = true

const registered = {}
let isVerbose = false
let isFlame = false

function cmd(command, callback) {
  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.log(`error: ${error.message}`)
      return
    }
    if (stderr) {
      console.log(`stderr: ${stderr}`)
      return
    }
    callback(stdout)
  })
}

ipc.serve(() => {
  ipc.server.on('profile-register', (data, socketFrom) => {
    if (!registered[data.pid]) {
      registered[data.pid] = true
      let command
      if (process.platform === 'win32') {
        command = `wmic process where processId=${data.pid} get CommandLine`
      } else {
        command = `cat /proc/${data.pid}/cmdline | xargs -0 echo`
      }
      cmd(command, (result) => {
        console.log('\n', 'Process detected at', data.pid, 'Details:', result.replaceAll('\n', ''))
      })
    }
  })
  ipc.server.on('profile-reply-full', message => {
    if (isFlame) {
      profileToFlame(JSON.parse(message))
    } else {
      profileToBottomsUp(JSON.parse(message))
    }
  })

  if (process.argv[2] === 'inject') {
    if (process.platform === 'win32') {
      console.log('Windows support for the injector not yet implemented')
      return
    }
    console.log('Injecting interface into process', process.argv[3])
    try {
      cmd('cat commands | { while read l ; do sleep 2; echo $l; done } | NTOP=$(npm -g root)"/ntop" node inspect -p ' + process.argv[3], (resp) => {
        console.log(resp)
        if (resp.includes('ntop-enabled')) console.log(`The process is now ready for profiling! Run "ntop ${process.argv[3]}"`)
      })
    } catch (error) {
      console.log('Injector error', error)
    }
    console.log('...')
  } else if (process.argv[2]) {
    profileClient(process.argv[2], process.argv[3] || 3000, process.argv.includes('-v'), process.argv.includes('-f'))
  }
})
ipc.server.start()

function profileClient(procId, time, verbose, flame) {
  isVerbose = verbose
  isFlame = flame
  const clientId = 'node-proc-' + procId
  console.log('Profiling client', clientId, ' time ', time)

  ipc.connectTo(clientId, () => {
    ipc.of[clientId].on('connect', () => {
      ipc.of[clientId].emit('profile-task', { time })
    })
  })
}

function showTree(item, depth = 0) {
  const dashes = new Array(depth + 1).fill('-').join('')
  if (item.name !== '(idle)') {
    console.log(dashes, item.name, formatExec(item.executionTime))
  }
  if (item.children) item.children.forEach(item2 => showTree(item2, depth + 1))
}

function findParents(nodes, id) {
  return nodes.filter(el => el.children && el.children.includes(id) && el.callFrame.functionName !== '(root)')
}

function findRoot(nodes, id) {
  const parent = nodes.find(el => el.children && el.children.includes(id) && el.callFrame.functionName !== '(root)')
  if (parent) {
    return findRoot(nodes, parent.id)
  }
  return nodes.find(el => el.id === id)
}

function rootIsFromProfiler(nodes, id) {
  const root = findRoot(nodes, id)
  if (root && root.callFrame.functionName === 'onStreamRead') return true
  return false
}

function nname(node) {
  return node.callFrame.functionName
}

function getParentsString(nodes, id, depth = 0) {
  const arrows = new Array(depth + 1).fill('<').join('')
  let text = ''
  findParents(nodes, id).forEach(pnode => {
    text += ' < ' + nname(pnode) + getParentsString(nodes, pnode.id, depth + 1)
  })
  return text
}

function profileToBottomsUp(profile) {
  console.log('\nBottom up:\n')
  profile.nodes.forEach(node => { node.callFrame.functionName = node.callFrame.functionName || '(anonymous)' })
  const { reducedSamples, reducedTimeDeltas } = getFlattenedSamples(profile)
  const entries = []
  reducedSamples.forEach((sampleId, i) => {
    let node = profile.nodes[sampleId - 1]
    if (node.id !== sampleId) {
      // sometimes the above is incorrect
      node = profile.nodes.find(el => el.id === sampleId)
    }
    const frame = node.callFrame
    entries.push({ frame, node, time: reducedTimeDeltas[i] })
  })

  entries.sort((a, b) => b.time - a.time)
  const longest = entries.reduce((max, el) => Math.max(el.frame.functionName.length, max), 0)
  entries.forEach(({ frame, node, time }) => {
    if (frame.functionName === '(idle)') return
    if (frame.functionName === 'dispatch' && rootIsFromProfiler(profile.nodes, node.id)) return
    // `/ ${node.hitCount} hit` + (node.hitCount !== 1 ? 's' : ''),
    const padding = new Array(longest - frame.functionName.length).fill(' ').join('') || ''
    console.log('*', frame.functionName + padding, '|', formatExec(time), '|', formatUrl(frame))
    if (isVerbose) {
      const parentString = getParentsString(profile.nodes, node.id)
      if (parentString) console.log(parentString, '\n')
    }

    if (node.children && node.children.length) {
      const added = []
      node.children.forEach(childId => {
        if (added.includes(childId)) return
        added.push(childId)
        const node2 = profile.nodes.find(el => el.id === childId)
        console.log(' -', node2.callFrame.functionName) //, formatUrl(frame))
      })
    }
  })
}

function profileToFlame(profile) {
  const flame = convertToMergedFlameGraph(profile)
  flame.children.splice(0, 1) // remove the first entry (it's profiler stuff)
  console.log('\nFlame chart:\n')
  showTree(flame)
}

function formatUrl(frame) {
  if (!frame.url) return ''
  return frame.url + ':' + frame.lineNumber + ':' + frame.columnNumber
}

function formatExec(uTime) {
  return uTime / 1000 + 'ms'
}

function getFlattenedSamples(_a) {
  const { samples, timeDeltas } = _a
  const reducedSamples = []
  const reducedTimeDeltas = []
  for (let i = 0, il = samples.length; i < il; i++) {
    const inExisting = reducedSamples.indexOf(samples[i])
    if (inExisting !== -1) {
      reducedTimeDeltas[inExisting] += timeDeltas[i]
    } else {
      reducedSamples.push(samples[i])
      reducedTimeDeltas.push(timeDeltas[i])
    }
  }
  return { reducedSamples, reducedTimeDeltas }
}