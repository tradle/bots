const { EventEmitter } = require('events')
const {
  co,
  isPromise,
  series,
  bubble,
  addAndRemover,
  once
} = require('./utils')

module.exports = function createHooks (obj) {
  const hooks = new EventEmitter()
  const handlers = {}
  const defaults = {}

  hooks.fire = co(function* (event, ...args) {
    const fns = getHandlers(event)
    if (fns && fns.length) {
      yield series(fns, ...args)
    }

    hooks.emit(event, ...args)
  })

  hooks.bubble = co(function* (event, ...args) {
    const fns = getHandlers(event)
    if (fns && fns.length) {
      const keepGoing = yield bubble(fns, ...args)
      if (keepGoing === false) return false
    }

    hooks.emit(event, ...args)
  })

  hooks.hook = function (event, handler) {
    if (!(event in handlers)) {
      handlers[event] = []
    }

    handlers[event].push(handler)
    return once(function unhook () {
      handlers[event].splice(handlers[event].indexOf(handler), 1)
    })
  }

  hooks.default = function (event, handler) {
    // wrap in array for processing convenience later
    defaults[event] = [handler]
  }

  function getHandlers (event) {
    const forEvent = handlers[event]
    if (forEvent && forEvent.length) return forEvent

    return defaults[event]
  }

  return hooks
}
