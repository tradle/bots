const queuey = require('queuey')

module.exports = function makeQueueManager ({ path, worker }) {
  const queues = queuey(path)
  const running = {}

  function getQueue (user) {
    const id = user.id
    if (!running[id]) {
      running[id] = queues.queue({ name: id, worker })
    }

    return running[id]
  }

  function enqueue (user, data) {
    getQueue(user).enqueue({ user, data })
  }

  function pause (user) {
    if (user) {
      getQueue(user).stop()
    } else {
      for (var id in running) {
        running[id].stop()
      }
    }
  }

  function resume (user) {
    if (user) {
      getQueue(user).start()
    } else {
      for (var id in running) {
        running[id].start()
      }
    }
  }

  return {
    get: getQueue,
    enqueue,
    pause,
    resume
  }
}

