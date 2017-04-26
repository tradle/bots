
const { EventEmitter } = require('events')
const RESOLVED = Promise.resolve()

module.exports = function createSemaphore () {
  let open

  const ee = new EventEmitter()
  ee.on('stop', () => open = false)
  ee.on('go', () => open = true)

  function go () {
    ee.emit('go')
    return api
  }

  function stop () {
    ee.emit('stop')
    return api
  }

  function wait () {
    if (open) return RESOLVED

    return new Promise(resolve => {
      ee.once('go', resolve)
    })
  }

  const api = { stop, go, wait }
  return api
}
