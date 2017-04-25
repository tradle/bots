const debug = require('debug')('tradle:bots:strategy:base')
const {
  co,
  shallowClone
} = require('../utils')

module.exports = function baseProcessing (bot) {
  let active = true

  const postReceive = co(function* (data) {
    if (!active) return

    const { user, type, raw } = data
    yield bot.users.update({
      userId: user.id,
      update: user => {
        user.history.push(raw)
        return user
      }
    })

    debug(`received a "${type}" from "${user.id}"`)
    bot.emit('message', data)
  })

  function onReceive ({ user, type, raw }) {
    if (!active) return

    debug(`receiving a "${type}" from "${user.id}"`)

    raw.inbound = true
    raw.index = user.history.length
    // user.history.push(raw)
  }

  function onSent ({ user, data }) {
    const eventData = shallowClone(user, data)
    bot.emit('sent', eventData)
  }

  bot.hook.receive(onReceive)
  bot.hook.postreceive(postReceive)
  bot.hook.postsend(onSent)

  return () => active = false
}
