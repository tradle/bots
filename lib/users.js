
const {
  shallowExtend,
  shallowClone
} = require('./utils')

module.exports = function usersManager (db) {
  return {
    get: getUser,
    create: createUser,
    save: save,
    new: newUserState,
    list: listUsers,
    del: deleteUser,
    clear: clearUsers
  }

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
    return state
  }

  function deleteUser (user) {
    db.get('users')
      .unset(user.id || user)
      .value()
  }

  function clearUsers () {
    db.set('users', {}).value()
  }

  function save (user) {
    db.set(`users.${user.id}`, user).value()
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
