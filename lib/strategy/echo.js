
module.exports = function echoStrategy (bot) {
  return bot.addReceiveHandler(function onmessage ({ user, payload }) {
    bot.send({ userId: user.id, payload })
  })
}
