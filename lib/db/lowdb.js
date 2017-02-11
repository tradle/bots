
const low = require('lowdb')

module.exports = function persistWithLoadDB (dir) {
  const db = lowdb(dir)
  db.defaults({
      data: {}
    })
    .value()

  function get (key) {
    return db.get(getKey(key), value).value()
  }

  function set (key, value) {
    db.set(getKey(key), value).value()
  }

  function del (key) {
    db.del(getKey(key)).value()
  }

  function clear () {
    db.del('data').value()
  }

  function getKey (key) {
    return `${data}.${key}`
  }

  return {
    get,
    set,
    del,
    batch,
    clear
  }
}
