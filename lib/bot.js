
const { EventEmitter } = require('events')
const path = require('path')
const mkdirp = require('mkdirp')
const debug = require('debug')('tradle:bots:bot')
const createPromiseQueue = require('ya-promise-queue')
const {
  Promise,
  co,
  shallowExtend,
  assert,
  addAndRemover,
  series,
  bubble,
  forceLog,
  normalizeReceive
} = require('./utils')

const Errors = require('./errors')
const createMultiqueue = require('./queues')
const manageUsers = require('./users')
const manageSeals = require('./seals')
const manageStrategies = require('./strategies')
const createSender = require('./sender')
const createReceiver = require('./receiver')
const locker = require('./locker')
const rawCreateStore = require('./store')
const cachify = require('./cachify')
const createHooks = require('./hooks')

const defaultPlugins = [
  require('./strategy/base'),
  require('./strategy/identity'),
  require('./strategy/context'),
  require('./strategy/objects'),
  require('./strategy/nodupe')
]

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

  const bot = new EventEmitter()
  const lock = locker()

  bot.on('error', function (err) {
    debug(`experienced error: ${err.message}`)
  })

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

  ;['create', 'del', 'clear', 'update'].forEach(event => {
    users.hook[event](co(function* (...args) {
      if (event === 'del') {
        const user = args[0]
        yield Promise.all([
          sendQueues.clear(user),
          receiveQueues.clear(user)
        ])
      } else if (event === 'clear') {
        yield Promise.all([
          sendQueues.clear(),
          receiveQueues.clear()
        ])
      }

      bot.emit('user:' + event, ...args)
    }))
  })


  const promiseQueue = createPromiseQueue()

  // don't allow send/receive to mingle
  // to prevent race conditions on the user state object
  const strictlyQueued = fn => {
    return function polite (...args) {
      return promiseQueue.push(() => fn(...args))
    }
  }

  const sendQueues = createMultiqueue({
    inMemory,
    path: paths.sendqueues,
    worker: strictlyQueued(function (...args) {
      return sender.process(...args)
    })
  })

  const sender = createSender({
    bot,
    queue: sendQueues,
    send,
    shouldRetry: shouldRetry.send
  })

  const receiveQueues = createMultiqueue({
    inMemory,
    path: paths.receivequeues,
    worker: strictlyQueued(function (...args) {
      return receiver.process(...args)
    })
  })

  const receiver = createReceiver({
    bot,
    queue: receiveQueues,
    shouldRetry: shouldRetry.receive
  })

  const strategies = manageStrategies(bot)

  function useStrategy (...args) {
    return strategies.use(...args)
  }

  let started

  function start () {
    if (!started)

    started = true
    sendQueues.start()
    receiveQueues.start()
    seals.start()
  }

  if (autostart) process.nextTick(start)

  const hooks = shallowExtend({}, sender.hook, receiver.hook)

  hooks.readseal = seals.hook.read
  hooks.wroteseal = seals.hook.wrote
  hooks.newversionseal = seals.hook.newversion
  hooks.pushseal = seals.hook.push

  shallowExtend(bot, {
    lock,
    hook: hooks,
    use: useStrategy,
    strategies,
    users,
    shared,
    send: sender.enqueue,
    receive: receiver.enqueue,
    seals,
    seal: seals.seal,
    start,
    queued: {
      send: sendQueues.queued,
      receive: receiveQueues.queued,
      seal: seals.queued
    }
  })

  defaultPlugins.forEach(strategy => bot.use(strategy))
  return bot
}
