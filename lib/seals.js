const path = require('path')
const { EventEmitter } = require('events')
const debug = require('debug')('tradle:bots:seals')
const low = require('lowdb')
const queuey = require('queuey')
const {
  co,
  isPromise,
  shallowExtend,
  tryWithExponentialBackoff,
  assert,
  addAndRemover,
  series,
  safeStringify,
  toSafeJson
} = require('./utils')

const Errors = require('./errors')
const defaultShouldRetry = ({ link, err }) => {
  return !Errors.isNotFoundError(err) && !Errors.isDuplicateError(err)
}

module.exports = function manageSeals ({ dir, seal, shouldRetry=defaultShouldRetry, autostart=true }) {
  const emitter = new EventEmitter()
  emitter.on('error', function (err) {
    debug(`Error: "${err.link}"`, err.stack, err.type)
  })

  const readHandlers = []
  const wroteHandlers = []
  const addOnReadHandler = addAndRemover(readHandlers)
  const addOnWroteHandler = addAndRemover(wroteHandlers)

  const paths = {}
  if (dir) {
    paths.queue = path.join(dir, 'seal-queue.json')
    paths.seals = path.join(dir, 'seals.json')
  }

  const db = low(paths.seals)
  db.defaults({}).value()

  const queues = queuey(paths.queue)
  let queue

  const doSeal = co(function* doSeal ({ link }) {
    debug(`attempting to seal "${link}"`)
    const maybePromise = seal({ link })
    if (isPromise) yield maybePromise

    db.set(link, {}).value()
    debug(`sealed "${link}"`)
    emitter.emit('push')
  })

  const onread = co(function* onread (data) {
    try {
      yield series(readHandlers, data)
    } catch (err) {
      err.link = data.link
      debug(`error in custom onRead handler`)
      emitter.emit('error', Errors.forAction(err, 'onread'))
    }

    update(data)
    emitter.emit('read')
  })

  const onwrote = co(function* onwrote (data) {
    try {
      yield series(wroteHandlers, data)
    } catch (err) {
      err.link = data.link
      debug(`error in custom onWrote handler`)
      emitter.emit('error', Errors.forAction(err, 'onwrote'))
    }

    update(data)
    emitter.emit('wrote')
  })

  function update (data) {
    const { link } = data
    const stored = db.get(link).value() || {}
    shallowExtend(stored, data)
    db.set(link, stored).value()
  }

  function start () {
    if (queue) return

    queue = queues.queue({
      name: 'main',
      worker: worker,
      autostart
    })
  }

  /**
   * try to seal, repeatedly
   * @param  {String} options.link [description]
   * @return {Promise}
   */
  function worker ({ link }) {
    return tryWithExponentialBackoff(co(function* makeAttempt () {
      try {
        const ret = yield doSeal({ link })
        return ret
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
    }))
  }

  function list () {
    return db.value()
  }

  function get (link) {
    return db.get(link).value()
  }

  function enqueueSeal ({ link }) {
    assert(isLink(link), 'expected 32 byte hex string "link"')

    if (!queue) start()

    const queued = queue.queued()
    const duplicate = queued.find(item => item.link === link)
    if (duplicate) {
      throw new Error('this seal has already been queued')
    }

    queue.enqueue({ link })
  }

  if (autostart) start()

  return shallowExtend(emitter, {
    seal: enqueueSeal,
    get,
    list,
    onread,
    onwrote,
    start,
    queued: () => queue.queued(),
    addOnReadHandler,
    addOnWroteHandler
  })
}

function isLink (link) {
  return typeof link === 'string' &&
    link.length === 64 &&
    /[a-fA-F0-9]{64}/.test(link)
}
