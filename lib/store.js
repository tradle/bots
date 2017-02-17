const crypto = require('crypto')
const rawCreateStore = require('@tradle/kv-levelup')

module.exports = function (opts={}) {
  if (opts.inMemory) {
    opts.leveldown = require('memdown')
    if (!opts.path) {
      opts.path = crypto.randomBytes(20).toString('hex')
    }
  }

  return rawCreateStore(opts)
}
