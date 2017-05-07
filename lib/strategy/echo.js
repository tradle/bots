
const { co } = require('../utils')

module.exports = function echoStrategy (bot) {
  return bot.hook('receive', co(function* onmessage ({ user, object }) {
    // we received `object`
    // send it back
    yield bot.send({ userId: user.id, object })
  }))
}
