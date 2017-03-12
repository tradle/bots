const path = require('path')
const { EventEmitter } = require('events')
const debug = require('debug')('tradle:bots:seals')
const queuey = require('queuey')
const {
  co,
  isPromise,
  shallowExtend,
  tryWithExponentialBackoff,
  assert,
  addAndRemover,
  series,
  toSafeJson
} = require('./utils')

const Errors = require('./errors')
const defaultShouldRetry = ({ link, err }) => !Errors.isNotFoundError(err) && !Errors.isDuplicateError(err)

module.exports = function manageSeals ({
  inMemory,
  dir,
  prefix='seals',
  store,
  seal,
  shouldRetry=defaultShouldRetry,
  autostart=true
}) {
  const emitter = new EventEmitter()
  emitter.on('error', function (err) {
    debug(`Error: "${err.link}"`, err.stack, err.type)
  })

  const readHandlers = []
  const wroteHandlers = []
  const newVersionHandlers = []
  const addOnReadHandler = addAndRemover(readHandlers)
  const addOnNewVersionHandler = addAndRemover(newVersionHandlers)
  const addOnWroteHandler = addAndRemover(wroteHandlers)
  const queues = inMemory ? queuey() : queuey(path.join(dir, prefix + '-queue'))

  let queue
  const doSeal = co(function* doSeal ({ link }) {
    debug(`attempting to seal "${link}"`)
    const maybePromise = seal({ link })
    if (isPromise) yield maybePromise

    yield store.put(link, {})
    debug(`sealed "${link}"`)
    emitter.emit('push')
  })

  const onread = co(function* (data) {
    try {
      yield series(readHandlers, data)
    } catch (err) {
      err.link = data.link
      debug(`error in custom onRead handler`)
      emitter.emit('error', Errors.forAction(err, 'onread'))
    }

    yield update(data)
    emitter.emit('read')
  })

  const onnewversion = co(function* (data) {
    try {
      yield series(newVersionHandlers, data)
    } catch (err) {
      err.link = data.prevLink
      debug(`error in custom onRead handler`)
      emitter.emit('error', Errors.forAction(err, 'onnewversion'))
    }

    update({
      link: data.prevLink,
      nextVersion: data
    })

    emitter.emit('newversion')
  })

  const onwrote = co(function* (data) {
    try {
      yield series(wroteHandlers, data)
    } catch (err) {
      err.link = data.link
      debug(`error in custom onWrote handler`)
      emitter.emit('error', Errors.forAction(err, 'onwrote'))
    }

    yield update(data)
    emitter.emit('wrote')
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
    if (queue) return

    queue = queues.queue({
      name: 'main',
      worker,
      autostart
    })
  }

  const trySeal = co(function* trySeal ({ link }) {
    try {
      return yield doSeal({ link })
    } catch (err) {
      debug(`Error pushing seal ${link}`)
      err.link = link
      emitter.emit('error', err)
      let willRetry = shouldRetry({ link, err })
      if (isPromise(willRetry)) willRetry = yield willRetry

      if (!willRetry) {
        // save the error
        update({
          link,
          error: toSafeJson(err)
        })

        return debug(`giving up on sealing ${link}`)
      }

      // rethrow to trigger retry
      throw err
    }
  })

  /**
   * try to seal, repeatedly
   * @param  {String} options.link [description]
   * @return {Promise}
   */
  function worker ({ link }) {
    return tryWithExponentialBackoff({
      worker: () => trySeal({ link }),
      name: 'push seal'
    })
  }

  function list () {
    return store.list()
  }

  function get (link) {
    return store.get(link)
  }

  const enqueueSeal = co(function* enqueueSeal ({ link }) {
    assert(isLink(link), 'expected 32 byte hex string "link"')

    if (!queue) start()

    const queued = yield queue.queued()
    const duplicate = queued.find(item => item.link === link)
    if (duplicate) {
      throw new Error('this seal has already been queued')
    }

    return queue.enqueue({ link })
  })

  if (autostart) start()

  return shallowExtend(emitter, {
    seal: enqueueSeal,
    get,
    list,
    onread,
    onwrote,
    onnewversion,
    start,
    queued: () => queue.queued(),
    addOnReadHandler,
    addOnWroteHandler,
    addOnNewVersionHandler
  })
}

const HEX_64 = /[a-fA-F0-9]{64}/
function isLink (link) {
  return typeof link === 'string' &&
    link.length === 64 &&
    HEX_64.test(link)
}
