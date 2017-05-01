const { EventEmitter } = require('events')
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
  isProbablyDeveloperError,
  forceLog,
  typeforce,
  wait,
  BACKOFF_DEFAULTS
} = require('./utils')

const Errors = require('./errors')
const createHooks = require('./hooks')
const createSemaphore = require('./semaphore')
const types = require('./types')
const TYPE = '_t'
const SIG = '_s'
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

    // signing is done on the tradle server
    if (object[SIG]) {
      delete object[SIG]
      debug(`stripping "${SIG}" property, as signing is done on the Tradle server`)
    }

    const presendOpts = { user, object, other }
    const keepGoing = yield bubble(handlers.presend, presendOpts)
    if (keepGoing === false) {
      debug('message discarded by presend hook')
      emitter.emit('skip', presendOpts)
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
      yield series(handlers.postsend, { user, wrapper: result })
    } catch (err) {
      forceLog('post-send processing failed', err)
      throw err
    }
  })

  const processor = Multiqueue.process({ multiqueue, worker })
  processor.on('error', err => emitter.emit('error', err))

  const emitter = new EventEmitter()
  return shallowExtend(emitter, {
    hook: createHooks(handlers),
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
