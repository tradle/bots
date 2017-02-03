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
  assert
} = require('./utils')

const Errors = require('./errors')
const defaultShouldRetry = ({ link, err }) => {
  return !(Errors.isNotFound(err) || Errors.isDuplicate(err))
}

module.exports = function manageSeals ({ dir, seal, shouldRetry=defaultShouldRetry }) {
  const emitter = new EventEmitter()
  emitter.on('error', function (err) {
    debug(`failed to seal "${link}"`, err.stack, err.type)
  })

  const paths = {}
  if (dir) {
    paths.queue = path.join(dir, 'seal-queue.json')
    paths.seals = path.join(dir, 'seals.json')
  }

  const db = low(paths.seals)
  db.defaults({}).value()

  const queues = queuey(paths.queue)
  let seals

  const doSeal = co(function* doSeal ({ link }) {
    debug(`attempting to seal "${link}"`)
    const maybePromise = seal({ link })
    if (isPromise) yield maybePromise

    db.set(link, {}).value()
    debug(`sealed "${link}"`)
    emitter.emit('seal:push')
  })

  function onread (data) {
    update(data)
    emitter.emit('seal:read')
  }

  function onwrote (data) {
    update(data)
    emitter.emit('seal:wrote')
  }

  function update (data) {
    const { link } = data
    const stored = db.get(link).value() || {}
    shallowExtend(stored, data)
    db.set(link, stored).value()
  }

  function start () {
    if (seals) return

    seals = queues.queue({
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

  return shallowExtend(emitter, {
    seal: function enqueueSeal ({ link }) {
      assert(isLink(link), 'expected 32 byte hex string "link"')

      if (!seals) start()

      seals.enqueue({ link })
    },
    onread,
    onwrote,
    start,
    queued: () => seals.queued()
  })
}

function isLink (link) {
  return typeof link === 'string' &&
    link.length === 64 &&
    /[a-fA-F0-9]{64}/.test(link)
}
