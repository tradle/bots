const debug = require('debug')('tradle:bots:receiver')
const {
  co,
  series,
  forceLog,
  assert
} = require('./utils')

const Errors = require('./errors')
const createHooks = require('./hooks')
const TYPE = '_t'

module.exports = function createReceiver ({ bot, queue }) {
  const handlers = {
    receive: [],
    prereceive: [],
    postreceive: []
  }

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
    const unlock = yield bot.lock(id)
    const user = yield bot.users.getOrCreate(id)
    let skipped
    try {
      yield series(handlers.prereceive, {
        user,
        object: wrapper.object,
        raw: wrapper
      })
    } catch (err) {
      if (Errors.isSkipReceive(err)) {
        debug('skipping receive of message')
        skipped = true
        unlock()
        return
      }

      throw err
    }

    try {
      yield queue.enqueue(user, wrapper)
    } finally {
      unlock()
    }
  })

  /**
   * process an incoming message from a client
   * @param {Object} user           user state object
   * @param {Object} wrapper.object message object
   * @param {String} wrapper.link   unique message identifier
   * @return {Promise}
   */
  const doReceive = co(function* (user, wrapper) {
    // message object
    const receiving = normalizeReceive({ user, wrapper })
    yield series(handlers.receive, receiving)
    return receiving
  })

  const receiveOrHang = co(function* ({ user, data }) {
    try {
      return yield doReceive(user, data)
    } catch (err) {
      // important to display this one way or another
      forceLog(debug, `Error receiving message due to error in strategy. Pausing receive for user ${user.id}`, err)
      err = Errors.developer(err)
      bot.emit('error', Errors.forAction(err, 'receive'))
      return new Promise(resolve => {
        // stall this receive queue
        // after the developer fixes the error and restarts, receive will be re-attempted
      })
    }
  })

  const process = co(function* (data) {
    const ret = yield receiveOrHang(data)
    try {
      yield series(handlers.postreceive, ret)
    } catch (err) {
      debug('post-receive processing failed', err)
    }
  })

  return {
    hook: createHooks(handlers),
    enqueue: enqueueReceive,
    process: process
  }
}

function normalizeReceive ({ user, wrapper }) {
  const { objectinfo, object } = wrapper
  const type = object.object[TYPE]
  return {
    user,
    type,
    permalink: objectinfo.permalink,
    link: objectinfo.link,
    object: object.object,
    message: object,
    raw: wrapper
  }
}
