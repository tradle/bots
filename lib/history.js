const {
  Promise,
  collect,
  shallowExtend
} = require('./utils')

const sub = require('subleveldown')
const changesFeed = require('changes-feed')
const levelup = require('./levelup')
const DB_OPTS = levelup.defaultOpts

module.exports = function createHistory ({ db }) {
  const historyFeeds = {}

  function ensureHistoryFeed (userId) {
    if (!historyFeeds[userId]) {
      const feedDB = sub(db, userId, DB_OPTS)
      historyFeeds[userId] = Promise.promisifyAll(changesFeed(feedDB))
    }

    return historyFeeds[userId]
  }

  function createHistoryStream (userId, opts) {
    opts = shallowExtend({ keys: false }, opts)
    return ensureHistoryFeed(userId).createReadStream(opts)
  }

  function appendToHistory ({ userId, item }) {
    if (typeof userId !== 'string') {
      throw new Error('expected string "userId"')
    }

    return ensureHistoryFeed(userId).appendAsync(item)
  }

  function getUserHistory (userId, opts) {
    return collect(createHistoryStream(userId, opts))
  }

  function getUserHistoryLength (userId) {
    // changes feed starts at 1
    return ensureHistoryFeed(userId).countAsync()
      .then(count => count - 1)
  }

  return {
    createReadStream: createHistoryStream,
    get: getUserHistory,
    append: appendToHistory,
    length: getUserHistoryLength
  }
}
