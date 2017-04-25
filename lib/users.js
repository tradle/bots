const { EventEmitter } = require('events')
const {
  co,
  shallowExtend,
  series
} = require('./utils')

const createHooks = require('./hooks')
const locker = require('./locker')

module.exports = function usersManager ({ store }) {
  const emitter = new EventEmitter()
  const lock = locker()
  const primaryKey = 'id'
  const handlers = {
    create: { post: [] },
    delete: { post: [] },
    clear: { post: [] },
    update: { post: [] }
  }

  const hooks = createHooks(handlers)
  Object.keys(hooks).forEach(action => {
    hooks[action].post(function (...args) {
      emitter.emit(action, ...args)
    })
  })

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
      if (primaryKey in props && props[primaryKey] !== id) {
        throw new Error(`"${primaryKey}" is a reserved property`)
      }

      shallowExtend(state, props)
    }

    yield store.set(id, state)
    yield series(handlers.create.post, state)
    return state
  })

  const del = co(function* (user) {
    const id = user[primaryKey] || user
    yield store.del(id)
    yield series(handlers.delete.post, user)
  })

  const clear = co(function* () {
    yield store.clear()
    yield series(handlers.clear.post)
  })

  const set = co(function* (id, user) {
    yield store.set(id, user)
    yield series(handlers.update.post, user)
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
    hooks,
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
