
const debug = require('debug')('tradle:plugin:objects')
const { co } = require('../utils')
const Errors = require('../errors')
const { TYPE } = require('../constants')

/**
 * Save user's identity and profile on the user state object
 * @return {Function} uninstall strategy function
 */
module.exports = function objectsMap (bot) {

  const processMessage = co(function* ({ user, wrapper }) {
    const { metadata } = wrapper
    const messageLink = metadata.message.link
    const payloadLink = metadata.payload.link

    let { index } = metadata.message
    if (!index) index = yield bot.users.history.length(user.id)

    if (!user.objects) user.objects = {}
    if (!user.messages) user.messages = {}

    user.objects[payloadLink] = { index }
    user.messages[messageLink] = { index }
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
