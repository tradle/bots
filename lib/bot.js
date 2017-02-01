
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

module.exports = function bot ({ db, send, providers }) {
  setDBSchema(db)

  const emitter = new EventEmitter()
  const users = manageUsers(db)

  /**
   * process an incoming message from a client
   * @param {Object} options.object message object
   * @param {String} options.author unique identifier of the message author
   * @param {String} options.link   unique message identifier
   * @return {Promise}
   */
  const receive = co(function* receive ({ object, author, link }) {
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

    emitter.emit('message', {
      user: author,
      payload
    })
  })

  const sendMessage = co(function* sendMessage (provider, user, payload) {
    if (typeof user === 'string') {
      user = users.get(user) || users.create(user)
    }

    debug(`sending a message: ${provider} -> ${user.id}`)

    // TOOD: save unsent messages, resend on start
    if (typeof payload === 'string') {
      payload = createSimpleMessage(payload)
    }

    const maybePromise = send(provider, user.id, payload)
    if (isPromise) yield maybePromise

    user.history.push({ payload })
    users.save(user)

    debug(`sent a message: ${provider} -> ${user.id}`)
  })

  return shallowExtend(emitter, {
    users,
    receive,
    // export for use in repl and testing
    send: sendMessage
  })
}
