const changesFeed = require('changes-feed')

module.exports = function createFeed (db) {
  return changesFeed(db, { start: 0 })
}
