
const { co } = require('../utils')

module.exports = function echoStrategy (bot) {
  return bot.addReceiveHandler(co(function* onmessage ({ user, object, link }) {
    yield bot.send({ userId: user.id, object })
  }))
}
