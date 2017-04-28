const debug = require('debug')('tradle:bots:strategy:base')
const {
  co,
  shallowClone,
  omit
} = require('../utils')

module.exports = function baseProcessing (bot) {
  let active = true

  const postReceive = co(function* ({ user, type, wrapper }) {
    if (!active) return

    yield Promise.all([
      bot.users.history.append({
        userId: user.id,
        item: wrapper
      }),
      bot.users.save(user)
    ])

    debug(`received a "${type}" from "${user.id}"`)
    bot.emit('message', wrapper)
  })

  const onReceive = co(function* ({ user, type, wrapper }) {
    if (!active) return

    debug(`receiving a "${type}" from "${user.id}"`)

    wrapper.inbound = true
    wrapper.index = yield bot.users.history.length(user.id)
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
