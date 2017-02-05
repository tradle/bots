
const fs = require('fs')
const { EventEmitter } = require('events')
const low = require('lowdb')

module.exports = function sharedStorage (path) {
  let db = low(path)
  db.defaults({}).value()

  function get (key) {
    return key === undefined ? db.value() : db.get(key).value()
  }

  function set (key, value) {
    return db.set(key, value).value()
  }

  function clear () {
    fs.unlinkSync(path)
    db = low(path)
  }

  return {
    get,
    set,
    clear
  }
}
