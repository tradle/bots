
const { EventEmitter } = require('events')

const {
  shallowExtend,
  shallowClone
} = require('./utils')

module.exports = function usersManager (db) {
  const emitter = new EventEmitter()
  return shallowExtend(emitter, {
    get: getUser,
    create: createUser,
    save: save,
    new: newUserState,
    list: listUsers,
    del: deleteUser,
    clear: clearUsers
  })

  function getUser (id) {
    return db.get(`users.${id}`).value()
  }

  function createUser (id, props) {
    if (getUser(id)) throw new Error('user exists')

    const state = newUserState(id)
    if (props) {
      // allow override "history" for ease of testing
      if ('id' in props) {
        throw new Error('"id" is a reserved property')
      }

      shallowExtend(state, props)
    }

    db.set(`users.${id}`, state).value()
    emitter.emit('create', state)
    return state
  }

  function deleteUser (user) {
    const id = user.id || user
    db.get('users')
      .unset(id)
      .value()

    emitter.emit('delete', id)
  }

  function clearUsers () {
    db.set('users', {}).value()
    emitter.emit('clear')
  }

  function save (user) {
    db.set(`users.${user.id}`, user).value()
    emitter.emit('update', user)
  }

  function newUserState (id) {
    return {
      id,
      history: []
    }
  }

  function listUsers () {
    return shallowClone(db.get('users').value())
  }

}
