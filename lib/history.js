const {
  co,
  Promise,
  promisifyAll,
  collect,
  shallowExtend,
  pump,
  typeforce
} = require('./utils')

const sub = require('subleveldown')
const through = require('through2')
const lexint = require('lexicographic-integer')
// const Multiqueue = require('@tradle/multiqueue')
// const createSemaphore = require('./semaphore')
const changesFeed = require('./changes-feed')
const levelup = require('./levelup')
const DB_OPTS = levelup.defaultOpts

module.exports = function createHistory ({ db }) {
//   const multiqueue = Multiqueue.create({ db })

//   function appendToUserHistory ({ userId, item }) {
//     if (typeof userId !== 'string') {
//       throw new Error('expected string "userId"')
//     }

//     return ensureHistoryFeed(userId).appendAsync(item)
//   }

//   function getUserHistoryLength (userId) {
//     return ensureHistoryFeed(userId).countAsync()
//   }

//   function getUserHistoryItem ({ userId, index }) {
//     return multiqueue.queue(userId).getItemAtSeq(index)
//   }

//   return {
//     createReadStream: createHistoryStream,
//     get: getUserHistoryItem,
//     dump: getUserHistory,
//     append: appendToUserHistory,
//     length: getUserHistoryLength,
//     clear: clearUserHistory
//   }
// }

  // const semaphore = createSemaphore().go()
  const historyFeeds = {}
  const historyDBs = {}

  function ensureHistoryFeed (userId) {
    typeforce(typeforce.String, userId)
    if (!historyFeeds[userId]) {
      const feedDB = historyDBs[userId] = promisifyAll(sub(db, userId, DB_OPTS))
      historyFeeds[userId] = promisifyAll(changesFeed(feedDB))
    }

    return historyFeeds[userId]
  }

  function createHistoryStream (userId, opts) {
    typeforce(typeforce.String, userId)
    opts = shallowExtend({ keys: false }, opts)
    return ensureHistoryFeed(userId).createReadStream(opts)
  }

  const appendToHistory = co(function* ({ userId, item }) {
    const feed = ensureHistoryFeed(userId)
    // ensure feed is initialized
    yield feed.countAsync()
    item.metadata.index = feed.change + feed.queued + 1
    typeforce(typeforce.String, userId)
    return feed.appendAsync(item)
  })

  function getUserHistory (userId, opts) {
    typeforce(typeforce.String, userId)
    return collect(createHistoryStream(userId, opts))
  }

  function getUserHistoryLength (userId) {
    typeforce(typeforce.String, userId)
    return ensureHistoryFeed(userId).countAsync()
  }

  function clearUserHistory (userId) {
    typeforce(typeforce.String, userId)
    ensureHistoryFeed(userId)
    const historyDB = historyDBs[userId]
    return pump(
      historyDB.createKeyStream(),
      through.obj(function (key, enc, cb) {
        historyDB.del(key, cb)
      })
    )
  }

  function getUserHistoryItem ({ userId, index }) {
    typeforce(typeforce.String, userId)

    ensureHistoryFeed(userId)
    const historyDB = historyDBs[userId]
    return historyDB.getAsync(hexint(index))
  }

  return {
    createReadStream: createHistoryStream,
    get: getUserHistoryItem,
    dump: getUserHistory,
    append: appendToHistory,
    length: getUserHistoryLength,
    clear: clearUserHistory
  }
}

function hexint (n) {
  return lexint.pack(n, 'hex')
}
