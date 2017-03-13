
const debug = require('debug')('tradle:plugin:objects')
const { co } = require('../utils')
const Errors = require('../errors')
const TYPE = '_t'

/**
 * Save user's identity and profile on the user state object
 * @return {Function} uninstall strategy function
 */
module.exports = function objectsMap (bot) {
  const prereceive = bot.addPreReceiveHandler(co(function* onmessage ({ user, object, raw }) {
    const { link, index } = raw
    if (!link) {
      debug('expected message to have "link" property')
      return
    }

    if (!user.objects) user.objects = {}
    if (!user.messages) user.messages = {}

    user.objects[link] = { index }
    user.message[raw.link] = { index }
    user.getObjectByLink = getterForUser(user)
  }))

  const unsubs = [
    prereceive
  ]

  return function install () {
    unsubs.forEach(unsub => unsub())
  }
}

function getterForUser (user) {
  return link => {
    return user.history[user.objects[link]]
  }
}
