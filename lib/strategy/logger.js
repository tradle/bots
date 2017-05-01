const debug = require('debug')('tradle:bots:strategy:logger')

module.exports = function logger (bot) {
  const unsubs = Object.keys(bot.hook).map(method => {
    return bot.hook[method](function ({ user, type, link }) {
      if (user) {
        debug(`${method} ${type} (user: ${user.id})`)
      } else {
        debug(`${method} object ${link}`)
      }
    })
  })

  function uninstall () {
    unsubs.forEach(fn => fn())
  }

  return {
    uninstall
  }
}
