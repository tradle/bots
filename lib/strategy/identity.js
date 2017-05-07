
const { co } = require('../utils')
const { TYPE } = require('../constants')

/**
 * Save user's identity and profile on the user state object
 * @return {Function} uninstall strategy function
 */
module.exports = function identityStrategy (bot) {
  return bot.hook('receive', co(function* onmessage ({ user, type, wrapper }) {
    if (type !== 'tradle.SelfIntroduction' && type !== 'tradle.IdentityPublishRequest') return

    const { object } = wrapper.message
    const { identity, profile } = object
    if (identity) user.identity = identity
    if (profile) user.profile = profile
  }))
}
