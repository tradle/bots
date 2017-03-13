
const { co } = require('../utils')
const TYPE = '_t'

/**
 * Save user's identity and profile on the user state object
 * @return {Function} uninstall strategy function
 */
module.exports = function identityStrategy (bot) {
  return bot.addReceiveHandler(co(function* onmessage ({ user, object }) {
    const type = object[TYPE]
    if (type !== 'tradle.SelfIntroduction' && type !== 'tradle.IdentityPublishRequest') return

    const { identity, profile } = object
    if (identity) user.identity = identity
    if (profile) user.profile = profile
  }))
}
