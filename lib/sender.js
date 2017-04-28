const { EventEmitter } = require('events')
const debug = require('debug')('tradle:bots:sender')
const omit = require('object.omit')
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
  typeforce
} = require('./utils')

const Errors = require('./errors')
const createHooks = require('./hooks')
const createSemaphore = require('./semaphore')
const types = require('./types')
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

    // TODO: save unsent messages, resend on start
    let result = send({ userId, object, other })
    if (isPromise(result)) result = yield result

    typeforce(types.messageWrapper, result)

    yield Promise.all([
      users.history.append({
        userId,
        item: result || { object }
      }),
      users.save(user)
    ])

    debug(`sent a "${type}" to: "${userId}"`)
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

  const process = co(function* ({ queue, value }) {
    yield semaphore.wait()

    const userId = queue
    const user = yield bot.users.get(userId)
    const sendParams = {
      user,
      data: value
    }

    let wrapper
    try {
      wrapper = yield doSend(sendParams)
    } catch (err) {
      forceLog(`failed to send message to: ${userId}`, err)
      throw err
    }

    try {
      yield series(handlers.postsend, { user, wrapper })
    } catch (err) {
      forceLog('post-send processing failed', err)
      throw err
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

// function normalizeResponse ({ message, object }) {
//   const type = object.object[TYPE]
//   const raw = shallowClone(message)
//   raw.objectinfo = omit(object, ['object'])
//   return {
//     type,
//     permalink: object.permalink,
//     link: object.link,
//     object: object.object,
//     message: message.object,
//     raw
//   }
// }
