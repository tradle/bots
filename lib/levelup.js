
const levelup = require('levelup')
const safe = require('safedown')

module.exports = function createLevelup (path, inMemory) {
  let down
  if (inMemory) {
    down = require('memdown')
  } else {
    down = require('safedown')(require('leveldown'))
  }

  return levelup(path, {
    keyEncoding: 'utf8',
    valueEncoding: 'json',
    db: safe(down)
  })
}
