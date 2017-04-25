
const { co } = require('../utils')

/**
 * Set `context` prop
 */
module.exports = function contextStrategy (bot) {
  return bot.hooks.receive.on(function (data) {
    data.context = data.message.context
  })
}
