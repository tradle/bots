const Errors = require('./errors')
const debug = require('debug')('tradle:bots:sender')
const {
  co,
  isPromise,
  shallowClone,
  bubble,
  series,
  assert,
  validateObject,
  createSimpleMessage
} = require('./utils')

const createHooks = require('./hooks')
const createSemaphore = require('./semaphore')
const TYPE = '_t'
const SIG = '_s'

module.exports = function reliableSender ({ bot, multiqueue, send, shouldRetry }) {
  const handlers = {
    presend: [],
    postsend: []
  }

  const semaphore = createSemaphore().go()
  const doSend = co(function* ({ user, data }) {
    const { object, other } = data
    const { users } = bot
    const userId = user.id
    try {
      // TODO: make this more efficient
      user = yield users.get(userId)
    } catch (err) {
      throw Errors.userNotFound(`user not found: ${userId}`)
    }

    const type = object[TYPE]
    debug(`sending a "${type}" to: "${userId}"`)

    // TOOD: save unsent messages, resend on start
    let result = send({ userId, object, other })
    if (isPromise(result)) result = yield result

    yield users.update({
      userId,
      update: user => {
        user.history.push(result || { object })
        return user
      }
    })

    debug(`sent a "${type}" to: "${userId}"`)
  })

  const reliableSend = co(function* ({ user, data }) {
    while (true) {
      try {
        return yield doSend({ user, data })
      } catch (err) {
        debug(`failed to send message to: ${user.id}`)
        bot.emit('error', Errors.forAction(err, 'send'))
        let willRetry = shouldRetry({ user, data, err })
        if (isPromise(willRetry)) willRetry = yield willRetry

        if (!willRetry) {
          return debug(`giving up on sending ${JSON.stringify(data)} to ${user.id}`)
        }

        // retry
        yield semaphore.wait()
      }
    }
  })

  const enqueueSend = co(function* ({ userId, object, other={} }) {
    assert(typeof userId === 'string', 'expected string "userId"')
    assert(
      typeof object === 'object' || typeof object === 'string',
      'expected object or string "object"'
    )

    if (typeof object === 'string') {
      object = createSimpleMessage(object)
    } else {
      validateObject(object)
    }

    const user = yield bot.users.getOrCreate(userId)

    // signing is done on the tradle server
    if (object[SIG]) {
      delete object[SIG]
      debug(`stripping "${SIG}" property, as signing is done on the Tradle server`)
    }

    yield bubble(handlers.presend, { user, object, other })
    return yield multiqueue.enqueue({
      queue: userId,
      value: { object, other }
    })
  })

  const process = co(function* ({ queue, value }) {
    yield semaphore.wait()

    const data = {
      user: yield bot.users.get(queue),
      data: value
    }

    yield reliableSend(data)
    try {
      yield series(handlers.postsend, data)
    } catch (err) {
      debug('post-send processing failed', err)
      return
    }
  })

  return {
    hook: createHooks(handlers),
    process: process,
    enqueue: enqueueSend,
    pause: () => semaphore.go(),
    resume: () => semaphore.stop()
  }
}
