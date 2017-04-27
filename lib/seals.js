const path = require('path')
const { EventEmitter } = require('events')
const debug = require('debug')('tradle:bots:seals')
// const queuey = require('queuey')
const Multiqueue = require('@tradle/multiqueue')
const {
  co,
  isPromise,
  shallowExtend,
  assert,
  addAndRemover,
  series,
  toSafeJson,
  sharePromiseQueue
} = require('./utils')

const levelup = require('./levelup')
const Errors = require('./errors')
const createHooks = require('./hooks')
const createSemaphore = require('./semaphore')

module.exports = function manageSeals ({
  inMemory,
  dir,
  prefix='seals',
  store,
  seal
}) {

  const emitter = new EventEmitter()
  emitter.on('error', function (err) {
    debug(`Error: "${err.link}"`, err.stack, err.type)
  })

  const semaphore = createSemaphore()
  const handlers = {
    push: [],
    read: [],
    newversion: [],
    wrote: []
  }

  const hooks = createHooks(handlers)
  Object.keys(hooks).forEach(action => {
    hooks[action](function (...args) {
      emitter.emit(action, ...args)
    })
  })

  const dbPath = dir && path.join(dir, prefix + '-queue')
  const multiqueue = Multiqueue.create({
    db: levelup(dbPath, inMemory)
  })

  let queue
  let processor

  const doSeal = co(function* (data) {
    const { link } = data
    debug(`attempting to seal "${link}"`)
    const maybePromise = seal({ link })
    if (isPromise) yield maybePromise

    yield store.put(link, {})
    debug(`sealed "${link}"`)
    try {
      yield series(handlers.push, data)
    } catch (err) {
      err.link = link
      debug(`error in custom "push" handler`)
      emitter.emit('error', Errors.forAction(err, 'push'))
    }
  })

  const onread = co(function* (data) {
    yield update(data)

    try {
      yield series(handlers.read, data)
    } catch (err) {
      err.link = data.link
      debug(`error in custom onRead handler`)
      emitter.emit('error', Errors.forAction(err, 'read'))
    }
  })

  const onnewversion = co(function* (data) {
    yield update({
      link: data.prevLink,
      nextVersion: data
    })

    try {
      yield series(handlers.newversion, data)
    } catch (err) {
      err.link = data.prevLink
      debug(`error in custom onRead handler`)
      emitter.emit('error', Errors.forAction(err, 'newversion'))
    }
  })

  const onwrote = co(function* (data) {
    yield update(data)

    try {
      yield series(handlers.wrote, data)
    } catch (err) {
      err.link = data.link
      debug(`error in custom onWrote handler`)
      emitter.emit('error', Errors.forAction(err, 'wrote'))
    }
  })

  const update = co(function* update (data) {
    const { link } = data
    let stored
    try {
      stored = yield store.get(link)
    } catch (err) {
      debug(`received event for "${link}" seal I did not order. Just saying.`)
      stored = {}
    }

    shallowExtend(stored, data)
    return store.put(link, stored)
  })

  function start () {
    if (processor) return processor.start()

    semaphore.go()
    queue = multiqueue.queue('main')
    processor = Multiqueue.process({ multiqueue, worker }).start()
    processor.on('error', err => emitter.emit('error'))
  }

  function stop () {
    semaphore.stop()
    if (processor) processor.stop()
  }

  /**
   * try to seal, repeatedly
   * @param  {String} options.link [description]
   * @return {Promise}
   */
  const worker = co(function* ({ value }) {
    const { link } = value
    try {
      return yield doSeal({ link })
    } catch (err) {
      debug(`Error pushing seal ${link}`, err)
      err.link = link
      throw err
    }
  })

  function list () {
    return store.list()
  }

  function get (link) {
    return store.get(link)
  }

  const strictlyQueued = sharePromiseQueue()
  const enqueueSeal = strictlyQueued(co(function* (value) {
    const { link } = value
    assert(isLink(link), 'expected 32 byte hex string "link"')

    if (!queue) start()

    const queued = yield queue.queued()
    const duplicate = queued.find(item => item.value.link === link)
    if (duplicate) {
      throw new Error('refusing to queue existing seal')
    }

    return queue.enqueue({ value })
  }))

  return shallowExtend(emitter, {
    seal: enqueueSeal,
    get,
    list,
    onread,
    onwrote,
    onnewversion,
    queued: () => queue.queued(),
    hook: hooks,
    start,
    stop,
    pause: () => semaphore.stop(),
    resume: () => semaphore.go()
  })
}

const HEX_64 = /[a-fA-F0-9]{64}/
function isLink (link) {
  return typeof link === 'string' &&
    link.length === 64 &&
    HEX_64.test(link)
}
