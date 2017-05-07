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

  hooks.fire = co(function* (event, ...args) {
    const fns = handlers[event]
    if (fns && fns.length) {
      yield series(fns, ...args)
    }

    hooks.emit(event, ...args)
  })

  hooks.bubble = co(function* (event, ...args) {
    const fns = handlers[event]
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

  return hooks
}
