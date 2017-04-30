const ip = require('ip')
const Promise = require('bluebird')
const co = Promise.coroutine
const Backoff = require('backoff')
const shallowClone = require('xtend')
const shallowExtend = require('xtend/mutable')
const bodyParser = require('body-parser')
const safeStringify = require('safe-json-stringify')
const traverse = require('traverse')
const clone = require('clone')
const omit = require('object.omit')
const pick = require('object.pick')
const collect = Promise.promisify(require('stream-collector'))
const pump = Promise.promisify(require('pump'))
const typeforce = require('typeforce')
const debug = require('debug')('tradle:bots:utils')
const createPromiseQueue = require('ya-promise-queue')
const Errors = require('./errors')
const BACKOFF_DEFAULTS = {
  // randomisationFactor: 0,
  initialDelay: 1000,
  // 1 min
  maxDelay: 60000
}

const { DEV } = require('./env')
const TYPE = '_t'
const noop = function () {}

function createSimpleMessage (message) {
  return {
    [TYPE]: 'tradle.SimpleMessage',
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

  return body
}

function errorFromResponse (res) {
  const { body={}, text, status } = res
  const err = new Error(text)
  err.body = body.error || body
  err.status = status
  return err
}

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
      if (idx !== -1) {
        arr.splice(idx, 1)
        return true
      }
    }
  }
}

const series = co(function* (fns, ...args) {
  for (let i = 0; i < fns.length; i++) {
    let fn = fns[i]
    let maybePromise = fn(...args)
    if (isPromise(maybePromise)) {
      yield maybePromise
    }
  }
})

const bubble = co(function* (fns, ...args) {
  for (let i = 0; i < fns.length; i++) {
    let fn = fns[i]
    let ret = fn(...args)
    if (isPromise(ret)) {
      ret = yield ret
    }

    if (ret === false) return false
  }
})

// TODO: optimize
function toSafeJson (obj) {
  return JSON.parse(safeStringify(obj))
}

// function convertTradleWrapper (wrapper) {
//   // message object
//   const { object } = wrapper
//   const object = object.object
//   return {
//     object,
//     message: object,
//     raw: wrapper
//   }
// }

function normalizeConf (conf) {
  conf.providerURL = conf.providerURL.replace(/\/+$/, '')
  if (!conf.webhookURL) {
    conf.webhookURL = `http://${ip.address()}:${conf.port}`
  }

  if (conf.autostart !== false) {
    conf.autostart = true
  }

  return conf
}

function forceLog (debugNamespace, ...args) {
  /* eslint no-console: "off" */
  if (debugNamespace.enabled) debugNamespace(...args)
  else console.log(...args)
}

function validateObject (object) {
  if (hasUndefinedValues(object)) {
    throw new Error('object may not have undefined for any nested values')
  }
}

function hasUndefinedValues (obj) {
  let has
  traverse(obj).forEach(function (val) {
    if (val === undefined) {
      has = true
      /* eslint no-invalid-this: "off" */
      this.update(undefined, true) // stop traversing
    }
  })

  return has
}

function wait (millis, ...args) {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve(...args)
    }, millis)
  })
}

function sharePromiseQueue () {
  const queue = createPromiseQueue()
  return function makeStrictlyQueued (fn) {
    return function (...args) {
      return queue.push(() => fn(...args))
    }
  }
}

const DEVELOPER_ERRORS = [
  ReferenceError,
  SyntaxError,
  TypeError,
  RangeError
]

function isProbablyDeveloperError (err) {
  return DEVELOPER_ERRORS.some(ctor => err instanceof ctor)
}

function getMetadata (wrapper) {
  return pick(wrapper, ['author', 'recipient', 'link', 'permalink'])
}

function interpretWrapper (wrapper) {
  if (wrapper.metadata) return wrapper

  if (wrapper.objectinfo) {
    return {
      metadata: {
        message: getMetadata(wrapper),
        payload: wrapper.objectinfo
      },
      message: wrapper.object
    }
  }

  return {
    metadata: {
      message: getMetadata(wrapper.message),
      payload: getMetadata(wrapper.object)
    },
    message: wrapper.message.object
  }
}

module.exports = {
  Promise,
  co,
  clone,
  shallowClone,
  shallowExtend,
  omit,
  safeStringify,
  toSafeJson,
  createSimpleMessage,
  isPromise,
  bigJsonParser,
  sendRequest: co(sendRequest),
  assert,
  addAndRemover,
  series,
  bubble,
  normalizeConf,
  forceLog,
  validateObject,
  wait,
  pick,
  sharePromiseQueue,
  collect,
  pump,
  isProbablyDeveloperError,
  typeforce,
  interpretWrapper,
  BACKOFF_DEFAULTS
}
