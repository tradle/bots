const { SIG, TYPE } = require('../lib/constants')
const { co, shallowExtend } = require('../lib/utils')
const isGenerator = require('is-generator-function')
const crypto = require('crypto')

exports.fakeWrapper = fakeWrapper
exports.loudCo = loudCo

function fakeWrapper ({ from, to, object }) {
  object = shallowExtend({
    [SIG]: object[SIG] || newSig()
  }, object)

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
    message: {
      [TYPE]: 'tradle.Message',
      [SIG]: newSig(),
      object
    }
  }
}

function newLink () {
  return hex32()
}

function newSig () {
  return hex32()
}

function hex32 () {
  return randomHex(32)
}

function randomHex (n) {
  return crypto.randomBytes(n).toString('hex')
}

function loudCo (gen) {
  if (!isGenerator(gen)) {
    throw new Error('expected a generator function, got a regular one')
  }

  return co(function* (...args) {
    try {
      yield co(gen)(...args)
    } catch (err) {
      console.error(err)
      throw err
    }
  })
}
