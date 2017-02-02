
const { EventEmitter } = require('events')
const debug = require('debug')('samplebot:bot')
const {
  Promise,
  co,
  shallowClone,
  shallowExtend,
  createSimpleMessage,
  setDBSchema,
  isPromise
} = require('./utils')

const manageUsers = require('./users')

module.exports = function createBot ({ db, send, providers }) {
  setDBSchema(db)

  const bot = new EventEmitter()
  const users = manageUsers(db)

  /**
   * process an incoming message from a client
   * @param {Object} options.object message object
   * @param {String} options.author unique identifier of the message author
   * @param {String} options.link   unique message identifier
   * @return {Promise}
   */
  const receive = co(function* receive (wrapper) {
    const { object, author, link } = wrapper
    debug('receiving a message from ' + author)
    const user = users.get(author) || users.create(author)
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

    const payload = object.object
    user.history.push({
      inbound: true,
      payload: payload
    })

    users.save(user)
    debug('received a message from ' + author)

    bot.emit('message', {
      user,
      payload,
      message: object,
      raw: wrapper
    })
  })

  const sendMessage = co(function* sendMessage (user, payload) {
    if (typeof user === 'string') {
      user = users.get(user) || users.create(user)
    }

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

  const usedStrategies = new Map()

  function useStrategy (strategy) {
    const install = strategy.install ? strategy.install.bind(strategy) : strategy
    const disable = install(bot)
    usedStrategies.set(strategy, disable)
  }

  function getStrategies () {
    return [...usedStrategies.keys()]
  }

  function disableStrategy (strategy) {
    const disable = usedStrategies.get(strategy)
    if (!disable) throw new Error('strategy not enabled')

    disable()
  }

  const strategies = {
    use: useStrategy,
    get: getStrategies,
    disable: disableStrategy
  }

  return shallowExtend(bot, {
    strategies,
    users,
    receive,
    // export for use in repl and testing
    send: sendMessage,
  })
}
