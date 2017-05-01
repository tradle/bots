const {
  promisify,
  promisifyAll,
  shallowExtend
} = require('./utils')

const levelup = require('levelup')
const safe = require('safedown')

exports = module.exports = function createLevelup (path, inMemory) {
  let unsafe
  if (inMemory) {
    unsafe = require('memdown')
  } else {
    unsafe = require('leveldown')
  }

  const down = safe(unsafe)
  const db = levelup(path, shallowExtend({
    db: safe(down)
  }, exports.defaultOpts))

  promisifyAll(db)
  const destroy = promisify(unsafe.destroy.bind(unsafe, path))

  db.destroyAsync = function () {
    return db.closeAsync().then(() => destroy())
  }

  return db
}

exports.defaultOpts = {
  keyEncoding: 'utf8',
  valueEncoding: 'json'
}
