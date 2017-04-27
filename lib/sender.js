const { EventEmitter } = require('events')
const debug = require('debug')('tradle:bots:sender')
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
  isProbablyDeveloperError
} = require('./utils')

const Errors = require('./errors')
const createHooks = require('./hooks')
const createSemaphore = require('./semaphore')
const TYPE = '_t'
const SIG = '_s'

module.exports = function reliableSender ({ bot, multiqueue, send }) {
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

    yield users.history.append({
      userId,
      item: result || { object }
    })

    debug(`sent a "${type}" to: "${userId}"`)
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

  const process = co(function* ({ queue, value }) {
    yield semaphore.wait()

    const data = {
      user: yield bot.users.get(queue),
      data: value
    }

    try {
      yield doSend(data)
    } catch (err) {
      debug(`failed to send message to: ${user.id}`, err)
      throw err
    }

    try {
      yield series(handlers.postsend, data)
    } catch (err) {
      debug('post-send processing failed', err)
      return
    }
  })

  const emitter = new EventEmitter()
  return shallowExtend(emitter, {
    hook: createHooks(handlers),
    process: process,
    enqueue: enqueueSend,
    pause: () => semaphore.go(),
    resume: () => semaphore.stop()
  })
}
