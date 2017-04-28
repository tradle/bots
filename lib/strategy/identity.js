
const { co } = require('../utils')
const TYPE = '_t'

/**
 * Save user's identity and profile on the user state object
 * @return {Function} uninstall strategy function
 */
module.exports = function identityStrategy (bot) {
  return bot.hook.receive(co(function* onmessage ({ user, type, wrapper }) {
    if (type !== 'tradle.SelfIntroduction' && type !== 'tradle.IdentityPublishRequest') return

    const { object } = wrapper.data
    const { identity, profile } = object
    if (identity) user.identity = identity
    if (profile) user.profile = profile
  }))
}
