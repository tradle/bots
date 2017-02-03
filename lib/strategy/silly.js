
const {
  Promise,
  co
} = require('../utils')

const ONLINE = 'I\'m back! How long was I gone?'

module.exports = function sillyStrategy (bot) {
  const send = function (user, payload) {
    return bot.send({ userId: user.id, payload })
  }

  const users = bot.users.list()

  for (let id in users) {
    send(users[id], ONLINE)
  }

  function oncreate (user) {
    send(user, 'Nice to meet you!')
  }

  const onmessage = co(function* onmessage ({ user, payload }) {
    switch (payload._t) {
    case 'tradle.SelfIntroduction':
    case 'tradle.IdentityPublishRequest':
      if (!payload.profile) break

      let name = payload.profile.firstName
      let oldName = user.profile && user.profile.firstName
      user.profile = payload.profile
      bot.users.save(user)
      if (name !== oldName) {
        yield send(user, `${name}, eh? Hot name!`)
      }

      break
    case 'tradle.SimpleMessage':
      yield send(user, `tell me more about this "${payload.message}," it sounds interesting`)
      break
    case 'tradle.CustomerWaiting':
      yield send(user, 'Buahahaha! ...I mean welcome to my super safe world')
      break
    default:
      yield send(user, `Huh? What's a ${payload._t}? I only understand simple messages. One day, when I'm a real boy...`)
      break
    }
  })

  const removeHandler = bot.addReceiveHandler(onmessage)
  bot.users.on('create', oncreate)

  return function disable () {
    removeHandler()
    bot.users.removeListener('create', oncreate)
  }
}
