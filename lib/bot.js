
const path = require('path')
const low = require('lowdb')
const { EventEmitter } = require('events')
const debug = require('debug')('tradle:bots:bot')
const {
  Promise,
  co,
  shallowClone,
  shallowExtend,
  createSimpleMessage,
  isPromise,
  tryWithExponentialBackoff,
  assert,
  addAndRemover,
  series
} = require('./utils')

const Errors = require('./errors')
const managePersistentQueues = require('./queues')
const manageUsers = require('./users')
const manageSeals = require('./seals')

const DEFAULT_SHOULD_RETRY = {
  send: ({ user, data, err }) => {
    return !Errors.isNotFound(err) && !Errors.isDuplicate(err)
  },
  receive: ({ user, wrapper }) => {
    return true
  }
}

module.exports = createBot

function createBot ({ dir, send, seal, providers, shouldRetry=DEFAULT_SHOULD_RETRY }) {
  const paths = {}
  if (dir) {
    paths.users = path.join(dir, 'users.json')
    paths.sendQueues = path.join(dir, 'send-queues.json'),
    paths.receiveQueues = path.join(dir, 'receive-queues.json')
  }

  const bot = new EventEmitter()
  bot.on('error', function (err) {
    debug('Error:', err.stack)
  })

  const receiveHandlers = []
  bot.addReceiveHandler = addAndRemover(receiveHandlers)

  const users = manageUsers(paths.users)
  const seals = manageSeals({ seal, dir, shouldRetry: shouldRetry.seal })

  const enqueueSend = co(function* ({ userId, object }) {
    assert(typeof userId === 'string', 'expected string "userId"')
    assert(
      typeof object === 'object' || typeof object === 'string',
      'expected object or string "object"'
    )

    const user = users.get(userId) || users.create(userId)

    // signing is done on the tradle server
    if (object._s) {
      delete object._s
      debug('stripping _s property, as signing is done on the Tradle server')
    }

    sends.enqueue(user, object)
  })

  const enqueueReceive = co(function* (wrapper) {
    assert(typeof wrapper.author === 'string', 'expected string "author"')
    assert(typeof wrapper.object === 'object', 'expected object "object"')

    // a sample message object can be found below
    // you're likely most interested in the object: the "object" property
    // {
    //   "_s": "..signature..",
    //   "_n": "..sequence marker..",
    //   "_t": "tradle.Message",
    //   "recipientPubKey": { ..your tradle server's bot's pubKey.. },
    //   "object": {
    //     "_t": "tradle.SimpleMessage",
    //     "message": "this is one happy user!"
    //   }
    // }

    const id = wrapper.author
    const user = users.get(id) || users.create(id)
    receives.enqueue(user, wrapper)
  })

  /**
   * process an incoming message from a client
   * @param {Object} user           user state object
   * @param {Object} wrapper.object message object
   * @param {String} wrapper.link   unique message identifier
   * @return {Promise}
   */
  const doReceive = co(function* doReceive (user, wrapper) {
    debug('receiving a message from ' + user.id)

    // message object
    const { objectinfo, object, link } = wrapper
    wrapper.inbound = true
    user.history.push(wrapper)
    users.save(user)
    debug('received a message from ' + user.id)

    const receiving = {
      user,
      link: objectinfo.link,
      object: object.object,
      message: object,
      raw: wrapper
    }

    yield series(receiveHandlers, receiving)

    bot.emit('message', receiving)
  })

  const doSend = co(function* doSend (user, object) {
    debug(`sending a message to: "${user.id}"`)

    // TOOD: save unsent messages, resend on start
    if (typeof object === 'string') {
      object = createSimpleMessage(object)
    }

    const maybePromise = send({ userId: user.id, object })
    const result = isPromise(maybePromise) ? yield maybePromise : maybePromise
    user.history.push(result)
    users.save(user)

    debug(`sent a message to: ${user.id}`)
  })

  const sends = managePersistentQueues({
    path: paths.sendQueues,
    worker: co(function* sendForever ({ user, data }) {
      yield tryWithExponentialBackoff(co(function* () {
        try {
          return yield doSend(user, data)
        } catch (err) {
          debug(`failed to send message to: ${user.id}`)
          bot.emit('error', Errors.forAction(err, 'send'))
          let willRetry = shouldRetry.send({ user, data, err })
          if (isPromise(willRetry)) willRetry = yield willRetry

          if (!willRetry) {
            return debug(`giving up on sending ${JSON.stringify(data)} to ${user.id}`)
          }

          // rethrow to trigger retry
          throw err
        }
      }))

      bot.emit('sent', { user, object: data })
    })
  })

  const receives = managePersistentQueues({
    path: paths.receiveQueues,
    worker: co(function* tryReceive ({ user, data }) {
      try {
        return yield doReceive(user, data)
      } catch (err) {
        const msg = `Error receiving message due to error in strategy. Pausing receive for user ${user.id}`

        // important to display this one way or another
        // if (debug.enabled) debug(msg, err)
        // else console.error(msg, err)

        bot.emit('error', Errors.forAction(err, 'receive'))
        return new Promise(resolve => {
          // stall this receive queue
          // after the developer fixes the error and restarts, receive will be re-attempted
        })
      }
    })
  })

  sends.start()
  receives.start()
  seals.start()

  return shallowExtend(bot, {
    strategies: manageStrategies(bot),
    users,
    receive: enqueueReceive,
    // export for use in repl and testing
    send: enqueueSend,
    seals: seals,
    queued: {
      send: sends.queued,
      receive: receives.queued,
      seal: seals.queued
    }
  })
}

function manageStrategies (bot) {
  const usedStrategies = new Map()

  function use (strategy) {
    if (usedStrategies.get(strategy)) {
      throw new Error('already using this strategy')
    }

    const install = strategy.install ? strategy.install.bind(strategy) : strategy
    const disable = install(bot)
    if (typeof disable !== 'function') {
      throw new Error('strategy installation function should return a function that disables the strategy')
    }

    usedStrategies.set(strategy, disable)
  }

  function list () {
    return [...usedStrategies.keys()]
  }

  function disable (strategy) {
    const disableFn = usedStrategies.get(strategy)
    if (!disableFn) throw new Error('strategy not enabled')

    disableFn()
    usedStrategies.delete(strategy)
  }

  function clear () {
    list().forEach(disable)
  }

  return {
    use,
    list,
    disable,
    clear
  }
}
