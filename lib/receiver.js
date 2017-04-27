const { EventEmitter } = require('events')
const debug = require('debug')('tradle:bots:receiver')
const {
  co,
  bubble,
  series,
  forceLog,
  assert,
  shallowExtend
} = require('./utils')

const Errors = require('./errors')
const createHooks = require('./hooks')
const createSemaphore = require('./semaphore')
const TYPE = '_t'

module.exports = function createReceiver ({ bot, multiqueue }) {
  const handlers = {
    receive: [],
    prereceive: [],
    postreceive: []
  }

  const semaphore = createSemaphore().go()
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
    const user = yield bot.users.getOrCreate(id)
    const prereceiveOpts = {
      user,
      object: wrapper.object,
      raw: wrapper
    }

    const keepGoing = yield bubble(handlers.prereceive, prereceiveOpts)
    if (keepGoing === false) {
      debug('skipping receive of message')
      emitter.emit('skip', prereceiveOpts)
      return
    }

    yield multiqueue.enqueue({
      queue: id,
      value: wrapper
    })
  })

  const process = co(function* ({ queue, value }) {
    yield semaphore.wait()

    const user = yield bot.users.get(queue)
    let receiving
    try {
      receiving = normalizeReceive({ user, wrapper: value })
      yield series(handlers.receive, receiving)
    } catch (err) {
      // important to display this one way or another
      forceLog(debug, `Error receiving message due to error in strategy`, err)
      throw err
    }

    try {
      yield series(handlers.postreceive, receiving)
    } catch (err) {
      debug('post-receive processing failed', err)
    }
  })

  const emitter = new EventEmitter()
  return shallowExtend(emitter, {
    hook: createHooks(handlers),
    enqueue: enqueueReceive,
    process: process,
    pause: () => semaphore.stop(),
    resume: () => semaphore.resume()
  })
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
