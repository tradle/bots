
const { EventEmitter } = require('events')
const Cache = require('lru-cache')
const {
  co,
  shallowClone,
  clone
} = require('./utils')

const DEFAULT_OPTS = {
  max: 100,
  maxAge: 1000 * 60 * 60
}

module.exports = function cachify ({ store, copy, opts={} }) {
  opts = shallowClone(DEFAULT_OPTS, opts)
  const cache = new Cache(opts)
  const cachified = shallowClone(store)

  ;['set', 'put'].forEach(method => {
    cachified[method] = function (key, val) {
      cache.set(key, maybeClone(val))
      return store[method].apply(store, arguments)
    }
  })

  cachified.get = co(function* (key) {
    const cached = cache.get(key)
    if (cached) return maybeClone(cached)

    return store.get(key)
  })

  cachified.del = co(function* (key) {
    cache.del(key)
    yield store.del(key)
  })

  cachified.clear = co(function* () {
    cache.reset()
    yield store.clear()
  })

  return cachified

  function maybeClone (obj) {
    return copy ? clone(obj) : obj
  }
}
