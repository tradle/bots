
const path = require('path')
const low = require('lowdb')
const { EventEmitter } = require('events')
const debug = require('debug')('samplebot:bot')
const {
  Promise,
  co,
  shallowClone,
  shallowExtend,
  createSimpleMessage,
  setDBSchema,
  isPromise,
  tryWithExponentialBackoff,
  assert
} = require('./utils')

const managePersistentQueues = require('./queues')
const manageUsers = require('./users')

module.exports = createBot

function createBot ({ dir, send, providers }) {
  const paths = {}
  if (dir) {
    paths.users = path.join(dir, 'users.json')
    paths.sendQueues = path.join(dir, 'send-queues.json'),
    paths.receiveQueues = path.join(dir, 'receive-queues.json')
  }

  const bot = new EventEmitter()
  const users = manageUsers(paths.users)
  const sends = managePersistentQueues({
    path: paths.sendQueues,
    worker: co(function* sendForever ({ user, data }) {
      yield tryWithExponentialBackoff(() => doSend(user, data))
      bot.emit('sent', { user, payload: data })
    })
  })

  const receives = managePersistentQueues({
    path: paths.receiveQueues,
    worker: function receiveForever ({ user, data }) {
      return  tryWithExponentialBackoff(() => doReceive(user, data))
    }
  })

  sends.start()
  receives.start()

  const enqueueSend = co(function* ({ userId, payload }) {
    assert(typeof userId === 'string', 'expected string "userId"')
    assert(
      typeof payload === 'object' || typeof payload === 'string',
      'expected object or string "payload"'
    )

    const user = users.get(userId) || users.create(userId)

    // signing is done on the tradle server
    if (payload._s) {
      delete payload._s
      debug('stripping _s property, as signing is done on the Tradle server')
    }

    sends.enqueue(user, payload)
  })

  const enqueueReceive = co(function* (wrapper) {
    assert(typeof wrapper.author === 'string', 'expected string "author"')
    assert(typeof wrapper.object === 'object', 'expected object "object"')

    // a sample message object can be found below
    // you're likely most interested in the payload: the "object" property
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

    const { object, link } = wrapper
    const payload = object.object
    user.history.push({
      inbound: true,
      payload: payload
    })

    users.save(user)
    debug('received a message from ' + user.id)

    bot.emit('message', {
      user,
      payload,
      message: object,
      raw: wrapper
    })
  })

  const doSend = co(function* doSend (user, payload) {
    debug(`sending a message to: "${user.id}"`)

    // TOOD: save unsent messages, resend on start
    if (typeof payload === 'string') {
      payload = createSimpleMessage(payload)
    }

    try {
      const maybePromise = send({ userId: user.id, payload })
      if (isPromise) yield maybePromise
    } catch (err) {
      debug(`failed to send message to: ${user.id}`, err.stack)
      return
    }

    user.history.push({ payload })
    users.save(user)

    debug(`sent a message to: ${user.id}`)
  })

  return shallowExtend(bot, {
    strategies: manageStrategies(bot),
    users,
    receive: enqueueReceive,
    // export for use in repl and testing
    send: enqueueSend
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
