const Promise = require('bluebird')
const co = Promise.coroutine
const Backoff = require('backoff')
const shallowClone = require('xtend')
const shallowExtend = require('xtend/mutable')
const bodyParser = require('body-parser')
const BACKOFF_DEFAULTS = {
  randomisationFactor: 0,
  initialDelay: 1000,
  maxDelay: 60000, // 1 min
  maxTries: Infinity
}

function createSimpleMessage (message) {
  return {
    _t: 'tradle.SimpleMessage',
    message
  }
}

function setDBSchema (db) {
  db.defaults({
      users: {}
    })
    .value()

  return db
}

function isPromise (obj) {
  return obj && typeof obj.then === 'function'
}

function bigJsonParser () {
  return bodyParser.json({ limit: '50mb' })
}

function* sendRequest (req) {
  let res
  try {
    res = yield req
  } catch (err) {
    if (err.response) {
      throw errorFromResponse(err.response)
    } else {
      throw err
    }
  }

  const { ok, body } = res
  if (!ok) {
    throw errorFromResponse(res)
  }
}

function errorFromResponse (res) {
  const { body={}, text, status } = res
  const err = new Error(text)
  err.body = body.error || body
  err.status = status
  return err
}

const tryWithExponentialBackoff = co(function* tryWithExponentialBackoff (fn, opts=BACKOFF_DEFAULTS) {
  const backoff = Backoff.exponential(opts.backoff)
  const maxTries = opts.maxTries

  let tries = 0
  while (tries++ < maxTries) {
    try {
      let ret = yield fn()
      return ret
    } catch (err) {
      yield new Promise(resolve => {
        backoff.once('ready', resolve)
        backoff.backoff()
      })
    }
  }

  throw new Error('failed after retrying max tries')
})

module.exports = {
  Promise,
  co,
  shallowClone,
  shallowExtend,
  createSimpleMessage,
  setDBSchema,
  isPromise,
  bigJsonParser,
  sendRequest: co(sendRequest),
  tryWithExponentialBackoff
}
