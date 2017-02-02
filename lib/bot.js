
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
  tryWithExponentialBackoff
} = require('./utils')

const managePersistentQueues = require('./queues')
const manageUsers = require('./users')

module.exports = createBot

function createBot ({ dir, send, providers }) {
  const paths = {
    db: dir && path.join(dir, 'db.json'),
    sendQueues: dir && path.join(dir, 'send-queues.json'),
    receiveQueues: dir && path.join(dir, 'receive-queues.json')
  }

  const db = low(paths.db)
  setDBSchema(db)

  const bot = new EventEmitter()
  const users = manageUsers(db)

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

  const enqueueSend = co(function* (user, payload) {
    if (typeof user === 'string') {
      user = users.get(user) || users.create(user)
    }

    sends.enqueue(user, payload)
  })

  const enqueueReceive = co(function* (wrapper) {
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
      const maybePromise = send(user.id, payload)
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
    usedStrategies.set(strategy, disable)
  }

  function get () {
    return [...usedStrategies.keys()]
  }

  function disable (strategy) {
    const disableStrategy = usedStrategies.get(strategy)
    if (!disableStrategy) throw new Error('strategy not enabled')

    disableStrategy()
  }

  return {
    use,
    get,
    disable
  }
}
