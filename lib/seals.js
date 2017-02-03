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
  series
} = require('./utils')

const Errors = require('./errors')
const defaultShouldRetry = ({ link, err }) => {
  return !(Errors.isNotFound(err) || Errors.isDuplicate(err))
}

module.exports = function manageSeals ({ dir, seal, shouldRetry=defaultShouldRetry }) {
  const emitter = new EventEmitter()
  // emitter.on('error', function (err) {
  //   debug(`failed to seal "${err.link}"`, err.stack, err.type)
  // })

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
    emitter.emit('seal:push')
  })

  const onread = co(function* onread (data) {
    try {
      yield series(readHandlers, data)
    } catch (err) {
      err.link = data.link
      debug(`error in custom onRead handler: ${err.stack}`)
      emitter.emit('error', err)
    }

    update(data)
    emitter.emit('seal:read')
  })

  const onwrote = co(function* onwrote (data) {
    try {
      yield series(wroteHandlers, data)
    } catch (err) {
      err.link = data.link
      debug(`error in custom onWrote handler: ${err.stack}`)
      emitter.emit('error', err)
    }

    update(data)
    emitter.emit('seal:wrote')
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
      worker: worker
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
        emitter.emit('error', err)
        const giveUp = yield shouldRetry({ link, err })
        if (giveUp) {
          return debug(`giving up on sealing ${link}`)
        }

        // rethrow to trigger retry
        throw err
      }
    }))
  }

  function get (link) {
    return link ? db.get(link).value() : db.get().value()
  }

  return shallowExtend(emitter, {
    seal: function enqueueSeal ({ link }) {
      assert(isLink(link), 'expected 32 byte hex string "link"')

      if (!queue) start()

      queue.enqueue({ link })
    },
    get,
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
