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

module.exports = function manageSeals ({ dir, seal }) {
  const emitter = new EventEmitter()
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
    try {
      const maybePromise = seal({ link })
      if (isPromise) yield maybePromise

      db.set(link, {}).value()
    } catch (err) {
      debug(`failed to seal "${link}"`, err.stack)
      throw err
    }

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
      worker: function sealForever ({ link }) {
        return tryWithExponentialBackoff(() => doSeal({ link }))
      }
    })
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
