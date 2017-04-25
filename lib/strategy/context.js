
const { co } = require('../utils')

/**
 * Set `context` prop
 */
module.exports = function contextStrategy (bot) {
  return bot.hook.receive(function (data) {
    data.context = data.message.context
  })
}
