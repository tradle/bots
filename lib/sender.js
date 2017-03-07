const Errors = require('./errors')
const debug = require('debug')('tradle:bots:sender')
const {
  co,
  isPromise,
  tryWithExponentialBackoff,
} = require('./utils')

const TYPE = '_t'

module.exports = function reliableSender ({ bot, send, shouldRetry }) {
  const doSend = co(function* doSend (user, object) {
    const { users } = bot
    try {
      // TODO: make this more efficient
      user = yield users.get(user.id)
    } catch (err) {
      throw Errors.userNotFound(`user not found: ${user.id}`)
    }

    const type = object[TYPE]
    debug(`sending a "${type}" to: "${user.id}"`)

    // TOOD: save unsent messages, resend on start
    let result = send({ userId: user.id, object })
    if (isPromise(result)) result = yield result

    yield users.merge({
      id: user.id,
      history: user.history.concat(result || { object })
    })

    bot.emit('sent', { user, object })
    debug(`sent a "${type}" to: "${user.id}"`)
  })

  const trySend = co(function* trySend ({ user, data }) {
    try {
      return yield doSend(user, data)
    } catch (err) {
      debug(`failed to send message to: ${user.id}`)
      bot.emit('error', Errors.forAction(err, 'send'))
      let willRetry = shouldRetry({ user, data, err })
      if (isPromise(willRetry)) willRetry = yield willRetry

      if (!willRetry) {
        return debug(`giving up on sending ${JSON.stringify(data)} to ${user.id}`)
      }

      // rethrow to trigger retry
      throw err
    }
  })

  return co(function* reliableSend ({ user, data }) {
    yield tryWithExponentialBackoff({
      name: 'send message',
      worker: () => trySend({ user, data })
    })

    bot.emit('sent', { user, object: data })
  })
}
