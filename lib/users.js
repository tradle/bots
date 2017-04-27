const { EventEmitter } = require('events')
const debug = require('debug')('tradle:bots:users')
const sub = require('subleveldown')
const changesFeed = require('changes-feed')
const {
  co,
  shallowExtend,
  series,
  isPromise
} = require('./utils')

const levelup = require('./levelup')
const createHooks = require('./hooks')
const locker = require('./locker')
const primaryKey = 'id'

module.exports = function usersManager ({ store, history }) {
  const emitter = new EventEmitter()
  const lock = locker()
  const handlers = {
    create: [],
    del: [],
    update: []
  }

  const hooks = createHooks(handlers)
  Object.keys(hooks).forEach(action => {
    hooks[action](function (...args) {
      emitter.emit(action, ...args)
    })

    hooks[action](function (user) {
      debug(action, user ? user.id || user : '')
    })
  })

  if (history) {
    hooks.del(function (userId) {
      return history.clear(userId)
    })
  }

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
    yield series(handlers.create, state)
    return state
  })

  const del = co(function* (user) {
    const id = user[primaryKey] || user
    yield store.del(id)
    yield series(handlers.del, id)
  })

  const set = co(function* (id, user) {
    yield store.set(id, user)
    yield series(handlers.update, user)
  })

  const updateUser = co(function* ({ userId, update }) {
    const unlock = yield lock(userId)
    try {
      const user = yield getUser(userId)
      let updated = update(user)
      if (isPromise(updated)) updated = yield updated
      if (updated !== false) {
        yield set(userId, updated || user)
      }
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

  const ensureUser = co(function* (userId) {
    try {
      return yield getUser(userId)
    } catch (err) {
      return yield create(userId)
    }
  })

  function newUserState (id) {
    return {
      [primaryKey]: id
    }
  }

  return shallowExtend(emitter, {
    hook: hooks,
    get: getUser,
    getOrCreate: ensureUser,
    create,
    set,
    save,
    update: updateUser,
    new: newUserState,
    list: store.list.bind(store),
    del,
    history
  })
}
