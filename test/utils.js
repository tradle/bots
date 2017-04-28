const crypto = require('crypto')

exports.fakeWrapper = fakeWrapper

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
