const { EventEmitter } = require('events')
const {
  co,
  shallowExtend
} = require('./utils')

const locker = require('./locker')

module.exports = function usersManager ({ store }) {
  const emitter = new EventEmitter()
  const lock = locker()
  const primaryKey = 'id'

  function getUser (id) {
    return store.get(id)
  }

  const create = co(function* (id, props) {
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

    yield store.set(id, state)
    emitter.emit('create', state)
    return state
  })

  const del = co(function* (user) {
    const id = user[primaryKey] || user
    yield store.del(id)
    emitter.emit('delete', user)
  })

  const clear = co(function* () {
    yield store.clear()
    emitter.emit('clear')
  })

  const set = co(function* (id, user) {
    yield store.set(id, user)
    emitter.emit('update', user)
  })

  const merge = co(function* (user) {
    const id = user[primaryKey]
    const unlock = yield lock(id)
    try {
      const current = yield getUser(id)
      const updated = shallowExtend(current, user)
      return save(updated)
    } finally {
      unlock()
    }

    yield store.set(id, user)
    emitter.emit('update', user)
  })

  const save = co(function* (user) {
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
