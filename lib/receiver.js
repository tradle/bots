const { EventEmitter } = require('events')
const debug = require('debug')('tradle:bots:receiver')
const Multiqueue = require('@tradle/multiqueue')
const {
  co,
  bubble,
  series,
  forceLog,
  assert,
  shallowExtend,
  typeforce
} = require('./utils')

const Errors = require('./errors')
const createHooks = require('event-hooks')
const createSemaphore = require('./semaphore')
const types = require('./types')
const { TYPE } = require('./constants')

module.exports = function createReceiver ({ bot, multiqueue }) {
  const semaphore = createSemaphore().go()
  const hooks = createHooks()
  const enqueueReceive = co(function* (wrapper) {
    try {
      typeforce(types.messageWrapper, wrapper)
    } catch (err) {
      debug('discarding incoming message with invalid format', err)
      return
    }

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

    const id = wrapper.metadata.message.author
    const user = yield bot.users.getOrCreate(id)
    const prereceiveOpts = { user, wrapper }
    const keepGoing = yield hooks.bubble('prereceive', prereceiveOpts)
    if (keepGoing === false) {
      debug('skipping receive of message')
      hooks.emit('skip', prereceiveOpts)
      return
    }

    yield multiqueue.enqueue({
      queue: id,
      value: wrapper
    })
  })

  const worker = co(function* ({ queue, value }) {
    yield semaphore.wait()

    const user = yield bot.users.get(queue)
    const receiveParams = { user, wrapper: value }
    try {
      yield hooks.fire('receive', receiveParams)
    } catch (err) {
      // important to display this one way or another
      forceLog(debug, `Error receiving message due to error in strategy. Pausing receive for user ${user.id}`, err)
      err = Errors.developer(err)
      hooks.emit('error', Errors.forAction(err, 'receive'))
      return new Promise(resolve => {
        // stall this receive queue
        // after the developer fixes the error and restarts, receive will be reattempted
      })
    }

    try {
      yield hooks.fire('postreceive', receiveParams)
    } catch (err) {
      forceLog('post-receive processing failed', err)
      throw err
    }
  })

  const processor = Multiqueue.process({ multiqueue, worker })
  processor.on('error', err => emitter.emit('error', err))

  const emitter = new EventEmitter()
  return shallowExtend(hooks, {
    enqueue: enqueueReceive,
    process: process,
    pause: () => semaphore.stop(),
    resume: () => semaphore.resume(),
    start: processor.start,
    stop: processor.stop,
    clearQueue: userId => multiqueue.queue(userId).clear()
  })
}
