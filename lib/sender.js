const debug = require('debug')('tradle:bots:sender')
const omit = require('object.omit')
const Multiqueue = require('@tradle/multiqueue')
const {
  co,
  isPromise,
  shallowClone,
  shallowExtend,
  bubble,
  series,
  assert,
  validateObject,
  createSimpleMessage,
  forceLog,
  typeforce,
  wait,
  BACKOFF_DEFAULTS
} = require('./utils')

const Errors = require('./errors')
const createHooks = require('event-hooks')
const createSemaphore = require('./semaphore')
const types = require('./types')
const { TYPE, SIG } = require('./constants')
const defaultShouldRetry = ({ user, data, err }) => {
  if (Errors.isDuplicateError(err) ||
    Errors.isUserNotFoundError(err) ||
    Errors.isUnknownIdentityError(err)) {
    return false
  }

  if (Errors.isNotFoundError(err)) {
    // if the provider is not online, retry
    return /Cannot POST/i.test(err.message)
  }

  return true
}

module.exports = function reliableSender ({
  bot,
  multiqueue,
  send,
  shouldRetry=defaultShouldRetry,
  backoff=BACKOFF_DEFAULTS
}) {
  const hooks = createHooks()
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

    // TODO: save unsent messages, resend on start
    let result = send({ userId, object, other })
    if (isPromise(result)) result = yield result

    typeforce(types.messageWrapper, result)

    return result
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
    const presendOpts = { user, object, other }
    const keepGoing = yield hooks.bubble('presend', presendOpts)
    if (keepGoing === false) {
      debug('message discarded by presend hook')
      hooks.emit('skip', presendOpts)
      return
    }

    return yield multiqueue.enqueue({
      queue: userId,
      value: { object, other }
    })
  })

  const reliableSend = co(function* ({ user, data }) {
    let delay = backoff.initialDelay
    while (true) {
      try {
        return yield doSend({ user, data })
      } catch (err) {
        debug(`failed to send message to: ${user.id}`)
        bot.emit('error', Errors.forAction(err, 'send'))
        if (Errors.isProbablyDeveloperError(err)) {
          forceLog(debug, `Error sending message due to error in strategy. Pausing send for user ${user.id}`, err)
          return new Promise(resolve => {
            // hang
          })
        }

        let willRetry = shouldRetry({ user, data, err })
        if (isPromise(willRetry)) willRetry = yield willRetry

        if (!willRetry) {
          debug(`giving up on sending ${JSON.stringify(data)} to ${user.id}`)
          return false
        }

        yield wait(delay)
        delay = Math.min(delay *= 2, backoff.maxDelay)
        // retry
        yield semaphore.wait()
      }
    }
  })

  const worker = co(function* ({ queue, value }) {
    yield semaphore.wait()

    const userId = queue
    const user = yield bot.users.get(userId)
    const sendParams = {
      user,
      data: value
    }

    const result = yield reliableSend(sendParams)
    if (result === false) return

    try {
      yield hooks.fire('postsend', { user, wrapper: result })
    } catch (err) {
      forceLog('post-send processing failed', err)
      throw err
    }
  })

  const processor = Multiqueue.process({ multiqueue, worker })
  processor.on('error', err => hooks.emit('error', err))
  return shallowExtend(hooks, {
    process: process,
    enqueue: enqueueSend,
    pause: () => semaphore.go(),
    resume: () => semaphore.stop(),
    queued: multiqueue.queued,
    start: processor.start,
    stop: processor.stop,
    clearQueue: userId => multiqueue.queue(userId).clear()
  })
}
