
const { EventEmitter } = require('events')
const path = require('path')
const mkdirp = require('mkdirp')
const debug = require('debug')('tradle:bots:bot')
const {
  Promise,
  co,
  shallowExtend,
  createSimpleMessage,
  assert,
  addAndRemover,
  series,
  forceLog,
  validateObject
} = require('./utils')

const Errors = require('./errors')
const managePersistentQueues = require('./queues')
const manageUsers = require('./users')
const manageSeals = require('./seals')
const manageStrategies = require('./strategies')
const reliableSender = require('./sender')
const locker = require('./locker')
const rawCreateStore = require('./store')
const cachify = require('./cachify')

function defaultCreateStore (...args) {
  return cachify({
    store: rawCreateStore(...args)
  })
}

const NAMESPACES = {
  users: 'users',
  shared: 'shared',
  sendqueues: 'sendqueues',
  receivequeues: 'receivequeues',
  seals: 'seals'
}

const DEFAULT_SHOULD_RETRY = {
  send: ({ user, data, err }) => {
    return !Errors.isNotFoundError(err) &&
      !Errors.isDuplicateError(err) &&
      !Errors.isUserNotFoundError(err)
  },
  receive: ({ user, wrapper }) => {
    return true
  }
}

const SIG = '_s'
const TYPE = '_t'

module.exports = createBot

/**
 * create a bot runner
 * @param  {Function}  opts.send           function to deliver a message to the provider
 * @param  {Function}  opts.seal           function to request the provider to seal an object on blockchain
 * @param  {String}    [opts.dir]          directory where to store databases. If omitted, in-memory databases will be used
 * @param  {Object}    [opts.shouldRetry=DEFAULT_SHOULD_RETRY]  functions to determine whether to retry failed operations
 * @param  {Boolean}   [opts.autostart] if true, queued operations will commence immediately
 * @return {Object}
 */
function createBot ({
  inMemory,
  dir,
  createStore=defaultCreateStore,
  send,
  seal,
  shouldRetry=DEFAULT_SHOULD_RETRY,
  autostart
}) {
  const paths = {}
  if (dir) {
    mkdirp.sync(dir)
    for (let name in NAMESPACES) {
      paths[name] = path.join(dir, NAMESPACES[name] + '-store')
    }
  }

  // else if (inMemory) {
  //   dir = crypto.randomBytes(20).toString('hex')
  // }

  const bot = new EventEmitter()
  const lock = locker()

  bot.on('error', function (err) {
    debug(`experienced error: ${err.message}`)
  })

  const handlers = {
    prereceive: [],
    receive: [],
    presend: []
  }

  const addReceiveHandler = addAndRemover(handlers.receive)
  const addPreReceiveHandler = addAndRemover(handlers.prereceive)
  const addPreSendHandler = addAndRemover(handlers.presend)
  const shared = createStore({
    inMemory,
    path: paths.shared
  })

  const users = manageUsers({
    store: createStore({
      inMemory,
      path: paths.users
    })
  })

  const seals = manageSeals({
    inMemory,
    seal,
    dir,
    prefix: 'seals',
    store: createStore({ path: paths.seals, inMemory }),
    shouldRetry: shouldRetry.seal
  })

  ;['push', 'read', 'wrote', 'newversion'].forEach(event => {
    seals.on(event, function (...args) {
      bot.emit('seal:' + event, ...args)
    })
  })

  ;['create', 'delete', 'clear', 'update'].forEach(event => {
    users.on(event, co(function* (...args) {
      if (event === 'delete') {
        const user = args[0]
        yield Promise.all([
          sends.clear(user),
          receives.clear(user)
        ])
      } else if (event === 'clear') {
        yield Promise.all([
          sends.clear(),
          receives.clear()
        ])
      }

      bot.emit('user:' + event, ...args)
    }))
  })

  const ensureUser = co(function* (userId) {
    try {
      return yield users.get(userId)
    } catch (err) {
      return yield users.create(userId)
    }
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

    const user = yield ensureUser(userId)

    // signing is done on the tradle server
    if (object[SIG]) {
      delete object[SIG]
      debug(`stripping "${SIG}" property, as signing is done on the Tradle server`)
    }

    yield series(handlers.presend, { user, object, other })
    return sends.enqueue(user, { object, other })
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
    const unlock = yield lock(id)
    try {
      const user = yield ensureUser(id)
      yield series(handlers.prereceive, {
        user,
        object: wrapper.object,
        raw: wrapper
      })

      return receives.enqueue(user, wrapper)
    } catch (err) {
      if (Errors.isSkipReceive(err)) {
        debug('skipping receive of message')
        return
      }

      throw err
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
    const { id } = user
    const { type } = receiving
    debug(`receiving a "${type}" from "${id}"`)

    wrapper.inbound = true
    wrapper.index = user.history.length
    user.history.push(wrapper)

    yield series(handlers.receive, receiving)
    yield users.save(user)

    debug(`received a "${type}" from "${id}"`)
    bot.emit('message', receiving)
  })

  const sends = managePersistentQueues({
    inMemory,
    path: paths.sendqueues,
    worker: reliableSender({
      bot,
      users,
      send,
      shouldRetry: shouldRetry.send
    })
  })

  const receives = managePersistentQueues({
    inMemory,
    path: paths.receivequeues,
    worker: co(function* tryReceive ({ user, data }) {
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
  })

  const strategies = manageStrategies(bot)

  function useStrategy (...args) {
    return strategies.use(...args)
  }

  let started

  function start () {
    if (!started)

    started = true
    sends.start()
    receives.start()
    seals.start()
  }

  if (autostart) process.nextTick(start)

  return shallowExtend(bot, {
    lock,
    use: useStrategy,
    strategies,
    users,
    shared,
    addReceiveHandler,
    addPreReceiveHandler,
    receive: enqueueReceive,
    // export for use in repl and testing
    addPreSendHandler,
    send: enqueueSend,
    seals,
    seal: seals.seal,
    start,
    queued: {
      send: sends.queued,
      receive: receives.queued,
      seal: seals.queued
    }
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
