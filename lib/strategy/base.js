const debug = require('debug')('tradle:bots:strategy:base')
const {
  co,
  shallowClone,
  omit
} = require('../utils')

const { TYPE } = require('../constants')

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
    bot.emit('message', { user, type, wrapper })
  }

  function onReceive ({ user, type, wrapper }) {
    const metadata = wrapper.metadata.message
    metadata.inbound = true
  }

  function announceSent ({ user, type, wrapper }) {
    bot.emit('sent', { user, type, wrapper })
  }

  function addType (data) {
    const object = data.object || data.wrapper.message.object
    data.type = object[TYPE]
  }

  const unsubs = [
    bot.hook.presend(addType),
    bot.hook.postsend(addType),
    bot.hook.prereceive(addType),
    bot.hook.receive(addType),
    bot.hook.postreceive(addType),
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
