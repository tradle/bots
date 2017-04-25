
const { isPromise, series } = require('./utils')

function PromiseEmitter () {
  this.removeAllListeners()
}

PromiseEmitter.prototype.removeAllListeners = function (event) {
  if (event) {
    delete this._listeners[event]
    delete this._proxies[event]
  } else {
    this._listeners = {}
    this._proxies = {}
  }

  return this
}

PromiseEmitter.prototype.removeListener = function (event, listener) {
  const listeners = this._listeners[event]
  if (listeners) {
    this._listeners[event] = listeners.filter(fn => fn !== listener)
    if (!this._listeners[event].length) {
      delete this._listeners[event]
      delete this._proxies[event]
    }
  }

  return this
}

PromiseEmitter.prototype.emit = function (event, ...args) {
  if (this._proxies[event]) {
    return this._proxies[event](...args)
  }

  return Promise.resolve()
}

PromiseEmitter.prototype.on = function (event, listener) {
  const self = this
  if (!this._proxies[event]) {
    this._proxies[event] = function proxy (...args) {
      const listeners = self._listeners[event]
      return series(listeners, ...args)
    }
  }

  if (!this._listeners[event]) {
    this._listeners[event] = []
  }

  this._listeners[event].push(listener)
  return this
}

PromiseEmitter.prototype.once = function (event, listener) {
  const proxy = co(function* () {
    try {
      listener(...arguments)
    } finally {
      this.removeListener(event, proxy)
    }
  })

  return this.on(event, proxy)
}

PromiseEmitter.prototype.setMaxListeners = function () {
  throw new Error('not implemented')
}

module.exports = PromiseEmitter
