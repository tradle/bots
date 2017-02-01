
const { shallowClone } = require('../utils')
const ONLINE = 'I\'m back! How long was I gone?'

module.exports = function install (bot) {
  const users = bot.users.list()
  for (let id in users) {
    bot.send(id, ONLINE)
  }

  bot.on('message', function ({ user, payload }) {
    const unsigned = shallowClone(payload)
    delete unsigned._s
    bot.send(user, unsigned)
  })
}
