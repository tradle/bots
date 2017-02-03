const Promise = require('bluebird')
const co = Promise.coroutine
const Backoff = require('backoff')
const shallowClone = require('xtend')
const shallowExtend = require('xtend/mutable')
const bodyParser = require('body-parser')
const debug = require('debug')('tradle:bots:utils')
const Errors = require('./errors')
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
      err = errorFromResponse(err.response)
    }

    if (err.status === 404) {
      err = Errors.notFound(err)
    } else if (err.status === 409) {
      err = Errors.duplicate(err)
    }

    throw err
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
      debug(`attempt to run ${fn.name} failed, backing off before retrying`, err)
      yield new Promise(resolve => {
        backoff.once('ready', resolve)
        backoff.backoff()
      })
    }
  }

  throw new Error('failed after retrying max tries')
})

function assert (statement, err) {
  if (!statement) {
    throw new Error(err || 'assertion failed')
  }
}

function addAndRemover (arr) {
  return function add (item) {
    arr.push(item)
    return function remove () {
      const idx = arr.indexOf(item)
      if (idx) {
        arr.splice(idx, 1)
        return true
      }
    }
  }
}

const series = co(function* series (fns, ...args) {
  for (let i = 0; i < fns.length; i++) {
    let fn = fns[i]
    let maybePromise = fn(...args)
    if (isPromise(maybePromise)) yield maybePromise
  }
})

module.exports = {
  Promise,
  co,
  shallowClone,
  shallowExtend,
  createSimpleMessage,
  isPromise,
  bigJsonParser,
  sendRequest: co(sendRequest),
  tryWithExponentialBackoff,
  assert,
  addAndRemover,
  series
}
