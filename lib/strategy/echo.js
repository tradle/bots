
module.exports = function echoStrategy (bot) {
  function onmessage ({ user, payload }) {
    bot.send({ userId: user.id, payload })
  }

  bot.on('message', onmessage)

  return function disable () {
    bot.removeListener('message', onmessage)
  }
}
