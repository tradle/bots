
const { EventEmitter } = require('events')
const path = require('path')
const mkdirp = require('mkdirp')
const debug = require('debug')('tradle:bots:bot')
const createPromiseQueue = require('ya-promise-queue')
const Multiqueue = require('@tradle/multiqueue')
const {
  Promise,
  co,
  shallowExtend,
  assert,
  addAndRemover,
  series,
  bubble,
  forceLog,
  normalizeReceive,
  sharePromiseQueue
} = require('./utils')

const Errors = require('./errors')
const manageUsers = require('./users')
const createHistory = require('./history')
const manageSeals = require('./seals')
const manageStrategies = require('./strategies')
const createSender = require('./sender')
const createReceiver = require('./receiver')
const locker = require('./locker')
const rawCreateStore = require('./store')
const cachify = require('./cachify')
const createHooks = require('./hooks')
const levelup = require('./levelup')

const defaultPlugins = [
  require('./strategy/base'),
  require('./strategy/identity'),
  require('./strategy/context'),
  require('./strategy/objects'),
  // require('./strategy/nodupe')
]

function defaultCreateStore (...args) {
  return cachify({
    store: rawCreateStore(...args)
  })
}

const NAMESPACES = {
  users: 'users',
  histories: 'histories',
  shared: 'shared',
  sendqueues: 'sendqueues',
  receivequeues: 'receivequeues',
  seals: 'seals'
}

const SIG = '_s'
const TYPE = '_t'

module.exports = createBot

/**
 * create a bot runner
 * @param  {Function}  opts.send           function to deliver a message to the provider
 * @param  {Function}  opts.seal           function to request the provider to seal an object on blockchain
 * @param  {String}    [opts.dir]          directory where to store databases. If omitted, in-memory databases will be used
 * @param  {Boolean}   [opts.autostart] if true, queued operations will commence immediately
 * @return {Object}
 */
function createBot ({
  inMemory,
  dir,
  createStore=defaultCreateStore,
  send,
  seal,
  autostart=true
}) {
  const paths = {}
  if (dir && !inMemory) {
    mkdirp.sync(dir)
    for (let name in NAMESPACES) {
      paths[name] = path.join(dir, NAMESPACES[name])
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
    }),
    history: createHistory({
      db: levelup(paths.histories, inMemory)
    })
  })

  const seals = manageSeals({
    inMemory,
    seal,
    dir,
    prefix: 'seals',
    store: createStore({ path: paths.seals, inMemory }),
  })

  seals.on('error', err => bot.emit('error', err))

  users.hook.del(co(function* (userId) {
    sendProcessor.stop(userId)
    receiveProcessor.stop(userId)
    yield Promise.all([
      sendQueues.queue(userId).clear(),
      receiveQueues.queue(userId).clear()
    ])
  }))

  const strictlyQueued = sharePromiseQueue()
  const reinitSendDB = co(function* () {
    yield sendDB.destroy()
    sendDB = levelup(paths.sendqueues, inMemory)
  })

  const reinitReceiveDB = co(function* () {
    yield receiveDB.destroy()
    receiveDB = levelup(paths.receivequeues, inMemory)
  })

  let sendDB = levelup(paths.sendqueues, inMemory)
  let receiveDB = levelup(paths.receivequeues, inMemory)

  const sendQueues = Multiqueue.create({ db: sendDB })
  const sender = createSender({
    bot,
    multiqueue: sendQueues,
    send,
  })

  const sendProcessor = Multiqueue.process({
    multiqueue: sendQueues,
    worker: strictlyQueued(sender.process)
  })

  const receiveQueues = Multiqueue.create({ db: receiveDB })
  const receiver = createReceiver({
    bot,
    multiqueue: receiveQueues,
  })

  const receiveProcessor = Multiqueue.process({
    multiqueue: receiveQueues,
    worker: strictlyQueued(receiver.process)
  })

  const strategies = manageStrategies(bot)

  function useStrategy (...args) {
    return strategies.use(...args)
  }

  function allTogetherNow (method) {
    [seals, sender, receiver].forEach(task => task[method]())
  }

  function processorsExec (method) {
    [seals, sendProcessor, receiveProcessor].forEach(processor => processor[method]())
  }

  ;[seals, sendProcessor, receiveProcessor].forEach(processor => {
    // unhandled errors should crash things
    processor.on('error', err => {
      process.nextTick(() => {
        throw err
      })
    })
  })

  let started
  let stopped

  function start () {
    if (stopped) throw new Error(`can't, I've been stopped`)
    if (started) return

    started = true
    processorsExec('start')
  }

  function stop () {
    if (stopped) return
    if (!started) throw new Error('not started yet')

    stopped = true
    processorsExec('stop')
  }

  if (autostart) process.nextTick(() => bot.start())

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
    stop,
    pause: () => allTogetherNow('pause'),
    resume: () => allTogetherNow('resume'),
    queued: {
      send: sendQueues.queued,
      receive: receiveQueues.queued,
      seal: seals.queued
    },
    sender,
    receiver
  })

  defaultPlugins.forEach(strategy => bot.use(strategy))
  return bot
}
