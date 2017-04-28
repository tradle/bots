
const { co } = require('../utils')
const Errors = require('../errors')
const TYPE = '_t'

/**
 * Save user's identity and profile on the user state object
 * @return {Function} uninstall strategy function
 */
module.exports = function noDuplicatesStrategy (bot) {
  return bot.hook.prereceive(co(function* onmessage ({ user, wrapper }) {
    const messageLink = wrapper.metadata.message.link
    const payloadLink = wrapper.metadata.payload.link
    if (messageLink && user.messages[messageLink]) {
      return false
    }

    if (payloadLink && user.objects[payloadLink]) {
      return false
    }
  }))
}
