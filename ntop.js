const inspector = require('node:inspector')
const fs = require('node:fs')
const ipc = require('node-ipc').default
ipc.config.id = 'node-proc-' + process.pid
ipc.config.retry = 1500
ipc.config.silent = true

let session
function runProfile(time, callback) {
  if (!session) session = new inspector.Session()
  session.connect()
  session.post('Profiler.setSamplingInterval 1', () => {})
  session.post('Profiler.enable', () => {
    session.post('Profiler.start', () => {
      setTimeout(() => {
        session.post('Profiler.stop', (err, { profile }) => {
          session.post('Profiler.disable', () => session.disconnect())
          if (!err) {
            const result = JSON.stringify(profile)
            fs.writeFileSync('./profile.cpuprofile', result)
            callback(result)
          }
        })
      }, time)
    })
  })
}

module.exports = () => {
  const profilerId = 'ntop'
  let profServer = null
  ipc.serve(() => ipc.server.on('profile-task', (message, socketFrom) => {
    runProfile(message.time, (res) => profServer.emit('profile-reply-full', res))
  }))

  // announce itself
  ipc.connectTo(profilerId, () => {
    profServer = ipc.of[profilerId]
    profServer.on('connect', () => {
      profServer.emit('profile-register', { pid: process.pid })
    })
  })
  ipc.server.start()
}
