const { EventEmitter } = require('events')
const {
  co,
  shallowExtend
} = require('./utils')

module.exports = function usersManager ({ store }) {
  const emitter = new EventEmitter()
  const primaryKey = 'id'

  function getUser (id) {
    return store.get(id)
  }

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

    yield store.set(id, state)
    emitter.emit('create', state)
    return state
  })

  const del = co(function* del (user) {
    const id = user[primaryKey] || user
    yield store.del(id)
    emitter.emit('delete', user)
  })

  const clear = co(function* clear () {
    yield store.clear()
    emitter.emit('clear')
  })

  const set = co(function* set (id, user) {
    yield store.set(id, user)
    emitter.emit('update', user)
  })

  const save = co(function* save (user) {
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
    new: newUserState,
    list: store.list.bind(store),
    del,
    clear
  })
}
