const { co } = require('../lib/utils')
const crypto = require('crypto')

exports.fakeWrapper = fakeWrapper
exports.loudCo = loudCo

function fakeWrapper ({ from, to, object }) {
  const msgLink = newLink()
  const objLink = newLink()
  return {
    metadata: {
      message: {
        author: from,
        recipient: to,
        link: msgLink,
        permalink: msgLink
      },
      payload: {
        author: from,
        link: objLink,
        permalink: objLink
      }
    },
    message: { object }
  }
}

function newLink () {
  return crypto.randomBytes(32).toString('hex')
}

function loudCo (gen) {
  return co(function* (...args) {
    try {
      yield co(gen)(...args)
    } catch (err) {
      console.error(err)
      throw err
    }
  })
}
