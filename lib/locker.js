
const once = require('once')
const mutexify = require('mutexify')
const debug = require('debug')('tradle:bots:locker')
const { Promise } = require('./utils')

module.exports = function (opts={}) {
  const {
    timeout,
    monitorInterval=5000
  } = opts

  const locks = {}
  return function lock (id) {
    if (!locks[id]) {
      locks[id] = mutexify()
    }

    const lock = locks[id]
    return new Promise(function (resolve, reject) {
      lock(function (unlock) {
        let timeoutID
        let monitorID
        const start = Date.now()

        if (timeout) {
          timeoutID = setTimeout(() => {
            debug(`lock timed out after ${Date.now() - start}ms, releasing`)
            doUnlock()
          }, timeout)

          unref(timeoutID)
        } else {
          monitorID = setInterval(() => {
            debug(`"${id}" still locked after ${Date.now() - start}ms, did you forgot to call unlock?`)
          }, monitorInterval)

          unref(monitorID)
        }

        const doUnlock = once(function () {
          clearTimeout(timeoutID)
          clearInterval(monitorID)
          unlock()
        })

        resolve(doUnlock)
      })
    })
  }
}

function unref (timer) {
  if (timer.unref) timer.unref()
}
