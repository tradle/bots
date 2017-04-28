
const debug = require('debug')('tradle:plugin:objects')
const { co } = require('../utils')
const Errors = require('../errors')
const TYPE = '_t'

/**
 * Save user's identity and profile on the user state object
 * @return {Function} uninstall strategy function
 */
module.exports = function objectsMap (bot) {

  const processMessage = co(function* ({ user, wrapper }) {
    const { metadata } = wrapper
    const msgLink = metadata.message.link
    const objLink = metadata.object.link

    let { index } = wrapper
    if (!index) index = yield bot.users.history.length(user.id)

    if (!user.objects) user.objects = {}
    if (!user.messages) user.messages = {}

    user.objects[objLink] = { index }
    user.messages[msgLink] = { index }
  })

  const unsubs = [
    bot.hook.postreceive(processMessage),
    bot.hook.postsend(processMessage)
  ]

  function uninstall () {
    unsubs.forEach(unsub => unsub())
  }

  return { uninstall }
}

function getterForUser (user) {
  return link => {
    const info = user.objects[link]
    if (info) {
      return user.history[info.index]
    }
  }
}
