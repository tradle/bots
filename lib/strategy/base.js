const debug = require('debug')('tradle:bots:strategy:base')
const {
  co
} = require('../utils')

module.exports = function baseProcessing (bot) {
  let active = true

  const saveUser = co(function* (data) {
    if (!active) return

    const { user, type } = data
    yield bot.users.save(user)

    debug(`received a "${type}" from "${user.id}"`)
    bot.emit('message', data)
  })

  function pushHistory ({ user, type, raw }) {
    if (!active) return

    debug(`receiving a "${type}" from "${user.id}"`)

    raw.inbound = true
    raw.index = user.history.length
    user.history.push(raw)
  }

  bot.hooks.receive.on(pushHistory)
  bot.hooks.receive.post(saveUser)
  return () => active = false
}
