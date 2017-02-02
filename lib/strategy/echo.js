
const { shallowClone } = require('../utils')

module.exports = function echoStrategy (bot) {
  function onmessage ({ user, payload }) {
    const unsigned = shallowClone(payload)
    // delete the user's signature
    // the server will re-sign it
    delete unsigned._s
    bot.send(user, unsigned)
  }

  bot.on('message', onmessage)

  return function disable () {
    bot.removeListener('message', onmessage)
  }
}
