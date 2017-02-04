
module.exports = function echoStrategy (bot) {
  return bot.addReceiveHandler(function onmessage ({ user, object }) {
    bot.send({ userId: user.id, object })
  })
}
