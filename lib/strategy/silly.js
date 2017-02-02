
const ONLINE = 'I\'m back! How long was I gone?'

module.exports = function sillyStrategy (bot) {
  const users = bot.users.list()
  for (let id in users) {
    bot.send(id, ONLINE)
  }

  function oncreate (user) {
    bot.send(user.id, 'Nice to meet you!')
  }

  function onmessage ({ user, payload }) {
    switch (payload._t) {
    case 'tradle.SelfIntroduction':
    case 'tradle.IdentityPublishRequest':
      if (!payload.profile) break

      let name = payload.profile.firstName
      let oldName = user.profile && user.profile.firstName
      user.profile = payload.profile
      bot.users.save(user)
      if (name !== oldName) {
        bot.send(user, `${name}, eh? Hot name!`)
      }

      break
    case 'tradle.SimpleMessage':
      bot.send(user, `tell me more about this "${payload.message}," it sounds interesting`)
      break
    case 'tradle.CustomerWaiting':
      bot.send(user, 'Buahahaha! ...I mean welcome to my super safe world')
      break
    default:
      bot.send(user, `Huh? What's a ${payload._t}? I only understand simple messages. One day, when I'm a real boy...`)
      break
    }
  }

  bot.on('message', onmessage)
  bot.users.on('create', oncreate)

  return function disable () {
    bot.removeListener('message', onmessage)
    bot.users.removeListener('create', oncreate)
  }

  // setTimeout(function () {
  //   bot.send(...)
  // }, 2000)
}
