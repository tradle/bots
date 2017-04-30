const debug = require('debug')('tradle:bots:strategy:base')
const {
  co,
  shallowClone,
  omit
} = require('../utils')

module.exports = function baseProcessing (bot) {
  function save ({ user, wrapper }) {
    return Promise.all([
      bot.users.history.append({
        userId: user.id,
        item: wrapper
      }),
      bot.users.save(user)
    ])
  }

  function announceReceived ({ user, type, wrapper }) {
    debug(`received a "${type}" from "${user.id}"`)
    bot.emit('message', wrapper)
  }

  function onReceive ({ user, type, wrapper }) {
    debug(`receiving a "${type}" from "${user.id}"`)

    const metadata = wrapper.metadata.message
    metadata.inbound = true
  }

  function announceSent ({ user, type, wrapper }) {
    const eventData = shallowClone(user, wrapper)
    bot.emit('sent', eventData)
  }

  const unsubs = [
    bot.hook.receive(onReceive),
    bot.hook.postreceive(save),
    bot.hook.postsend(save),
    bot.hook.postreceive(announceReceived),
    bot.hook.postsend(announceSent)
  ]

  function uninstall () {
    unsubs.forEach(fn => fn())
  }

  return {
    uninstall
  }
}
