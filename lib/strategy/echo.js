
const { shallowClone } = require('../utils')

module.exports = function install (bot) {
  bot.on('message', function ({ user, payload }) {
    const unsigned = shallowClone(payload)
    // delete the user's signature
    // the server will re-sign it
    delete unsigned._s
    bot.send(user, unsigned)
  })
}
