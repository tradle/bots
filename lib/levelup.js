
const levelup = require('levelup')
const TEST = process.env.TEST
const leveldown = TEST ? require('memdown') : require('leveldown')

module.exports = function createLevelup (path) {
  return levelup(path, {
    keyEncoding: 'utf8',
    valueEncoding: 'json',
    db: leveldown
  })
}
