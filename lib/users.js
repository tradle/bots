const { EventEmitter } = require('events')
const Cache = require('lru-cache')
const {
  co,
  shallowExtend,
  clone
} = require('./utils')

module.exports = function usersManager ({ store }) {
  const emitter = new EventEmitter()
  const primaryKey = 'id'
  const cache = new Cache({
    max: 100,
    maxAge: 1000 * 60 * 60
  })

  const getUser = co(function* getUser (id) {
    const cached = cache.get(id)
    if (cached) return clone(cached)

    return store.get(id)
  })

  const create = co(function* create (id, props) {
    let existing
    try {
      existing = yield getUser(id)
    } catch (err) {}

    if (existing) {
      throw new Error('user exists')
    }

    const state = newUserState(id)
    if (props) {
      // allow override "history" for ease of testing
      if (primaryKey in props) {
        throw new Error(`"${primaryKey}" is a reserved property`)
      }

      shallowExtend(state, props)
    }

    yield _set(id, state)
    emitter.emit('create', state)
    return state
  })

  function _set (key, val) {
    cache.set(key, clone(val))
    return store.set(key, val)
  }

  const del = co(function* del (user) {
    const id = user[primaryKey] || user
    cache.del(id)
    yield store.del(id)
    emitter.emit('delete', user)
  })

  const clear = co(function* clear () {
    cache.reset()
    yield store.clear()
    emitter.emit('clear')
  })

  const set = co(function* set (id, user) {
    yield _set(id, user)
    emitter.emit('update', user)
  })

  const merge = co(function* (props) {
    const current = yield getUser(props.id)
    const updated = shallowExtend(current, props)
    return save(updated)
  })

  const save = co(function* save (user) {
    // console.log(user.currentApplication, new Error().stack)
    if (!user[primaryKey]) {
      throw new Error(`expected string "${primaryKey}"`)
    }

    yield set(user[primaryKey], user)
  })

  function newUserState (id) {
    return {
      [primaryKey]: id,
      history: []
    }
  }

  return shallowExtend(emitter, {
    get: getUser,
    create,
    set,
    save,
    merge,
    new: newUserState,
    list: store.list.bind(store),
    del,
    clear
  })
}
