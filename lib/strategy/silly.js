
const ONLINE = 'I\'m back! How long was I gone?'

module.exports = function install (bot) {
  const users = bot.users.list()
  for (let id in users) {
    bot.send(id, ONLINE)
  }

  bot.on('message', function ({ user, payload }) {
    switch (payload._t) {
    case 'tradle.SimpleMessage':
      bot.send(user, `tell me more about this "${payload.message}," it sounds interesting`)
      return
    case 'tradle.CustomerWaiting':
      bot.send(user, 'Buahahaha! ...I mean welcome to my super safe world')
      break
    default:
      bot.send(user, 'Whoa! I\'m kinda stupid, I only understand simple messages')
      return
    }
  })
}
