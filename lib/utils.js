const Promise = require('bluebird')
const co = Promise.coroutine
const shallowClone = require('xtend')
const shallowExtend = require('xtend/mutable')
const bodyParser = require('body-parser')

module.exports = {
  Promise,
  co,
  shallowClone,
  shallowExtend,
  createSimpleMessage,
  setDBSchema,
  isPromise,
  bigJsonParser
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
