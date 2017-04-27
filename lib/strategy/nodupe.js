
const { co } = require('../utils')
const Errors = require('../errors')
const TYPE = '_t'

/**
 * Save user's identity and profile on the user state object
 * @return {Function} uninstall strategy function
 */
module.exports = function noDuplicatesStrategy (bot) {
  return bot.hook.prereceive(co(function* onmessage ({ user, object, raw }) {
    const { link } = raw
    if (link && user.getObjectByLink(link)) {
      return false
    }
  }))
}
