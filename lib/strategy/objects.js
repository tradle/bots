
const debug = require('debug')('tradle:plugin:objects')
const { co } = require('../utils')
const Errors = require('../errors')
const TYPE = '_t'

/**
 * Save user's identity and profile on the user state object
 * @return {Function} uninstall strategy function
 */
module.exports = function objectsMap (bot) {
  const prereceive = bot.hooks.receive.pre(co(function* onmessage ({ user, object, raw }) {
    const { objectinfo } = raw
    const { link } = objectinfo
    if (!link) {
      debug('expected message to have "link" property')
      return
    }

    const index = user.history ? user.history.length : 0

    if (!user.objects) user.objects = {}
    if (!user.messages) user.messages = {}

    user.objects[link] = { index }
    user.messages[raw.link] = { index }
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
    const info = user.objects[link]
    if (info) {
      return user.history[info.index]
    }
  }
}
