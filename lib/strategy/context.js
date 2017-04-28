
const { co } = require('../utils')

/**
 * Set `context` prop
 */
module.exports = function contextStrategy (bot) {
  return bot.hook.receive(function ({ wrapper }) {
    const { context } = wrapper.data.message
    if (context) wrapper.metadata.context = context
  })
}
