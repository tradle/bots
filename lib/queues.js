const queuey = require('queuey')
const {
  Promise,
  co
} = require('./utils')

module.exports = function makeQueueManager ({ path, worker, inMemory }) {
  const queues = queuey(inMemory ? null : path)
  const running = {}

  function getQueue (user) {
    const { id } = user
    if (!running[id]) {
      const q = running[id] = queues.queue({ name: id, worker })
      q.on('stop', function () {
        delete running[id]
      })
    }

    return running[id]
  }

  function enqueue (user, data) {
    return getQueue(user).enqueue({ user, data })
  }

  function pause (user) {
    if (user) {
      return getQueue(user).stop()
    }

    return mapRunning(q => q.stop())
  }

  function resume (user) {
    if (user) {
      return getQueue(user).start()
    }

    return mapRunning(q => q.start())
  }

  function mapRunning (fn) {
    return Promise.all(Object.keys(running)
      .map(id => fn(running[id])))
  }

  const start = co(function* start () {
    // start all queues
    const queued = yield queues.queued()
    for (let id in queued) {
      let queue = queued[id]
      if (queue.length) getQueue({ id })
    }
  })

  function clear (user) {
    if (user) {
      return queues.clear(user.id)
    }

    return queues.clear()
  }

  function stop (user) {
    if (user) {
      return queues.stop(user.id)
    }

    return queues.stop()
  }

  return {
    get: getQueue,
    enqueue,
    pause,
    resume,
    start,
    stop,
    clear
  }
}

