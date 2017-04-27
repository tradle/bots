const {
  Promise,
  shallowExtend
} = require('./utils')

const levelup = require('levelup')
const safe = require('safedown')

exports = module.exports = function createLevelup (path, inMemory) {
  let down
  if (inMemory) {
    down = require('memdown')
  } else {
    down = require('safedown')(require('leveldown'))
  }

  const db = levelup(path, shallowExtend({
    db: safe(down)
  }, exports.defaultOpts))

  Promise.promisifyAll(db)
  const destroy = Promise.promisify(down.destroy.bind(down, path))

  db.destroyAsync = function () {
    return db.closeAsync().then(() => destroy())
  }

  return db
}

exports.defaultOpts = {
  keyEncoding: 'utf8',
  valueEncoding: 'json'
}
