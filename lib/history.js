const {
  Promise,
  collect,
  shallowExtend,
  pump
} = require('./utils')

const sub = require('subleveldown')
const changesFeed = require('changes-feed')
const through = require('through2')
// const createSemaphore = require('./semaphore')
const levelup = require('./levelup')
const DB_OPTS = levelup.defaultOpts

module.exports = function createHistory ({ db }) {
  // const semaphore = createSemaphore().go()
  const historyFeeds = {}
  const historyDBs = {}

  function ensureHistoryFeed (userId) {
    if (!historyFeeds[userId]) {
      const feedDB = historyDBs[userId] = sub(db, userId, DB_OPTS)
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
    return ensureHistoryFeed(userId).countAsync()
  }

  function clearUserHistory (userId) {
    ensureHistoryFeed(userId)
    const historyDB = historyDBs[userId]
    return pump(
      historyDB.createKeyStream(),
      through.obj(function (key, enc, cb) {
        historyDB.del(key, cb)
      })
    )
  }

  return {
    createReadStream: createHistoryStream,
    get: getUserHistory,
    append: appendToHistory,
    length: getUserHistoryLength,
    clear: clearUserHistory
  }
}
