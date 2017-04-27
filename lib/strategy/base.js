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
    yield bot.users.history.append({
      userId: user.id,
      item: raw
    })

    debug(`received a "${type}" from "${user.id}"`)
    bot.emit('message', data)
  })

  const onReceive = co(function* ({ user, type, raw }) {
    if (!active) return

    debug(`receiving a "${type}" from "${user.id}"`)

    raw.inbound = true
    raw.index = yield bot.users.history.length(user.id)
  })

  function onSent ({ user, data }) {
    const eventData = shallowClone(user, data)
    bot.emit('sent', eventData)
  }

  bot.hook.receive(onReceive)
  bot.hook.postreceive(postReceive)
  bot.hook.postsend(onSent)

  return () => active = false
}
