
const ONLINE = 'I\'m back! How long was I gone?'

module.exports = function install (bot, provider) {
  const users = bot.users.list()
  for (let id in users) {
    bot.send(provider, id, ONLINE)
  }

  bot.on('message', function ({ user, payload }) {
    switch (payload._t) {
    case 'tradle.SimpleMessage':
      bot.send(provider, user, `tell me more about this "${payload.message}," it sounds interesting`)
      return
    default:
      bot.send(provider, user, 'Whoa! I\'m kinda stupid, I only understand simple messages')
      return
    }
  })
}
