
module.exports = function manageStrategies (bot) {
  const usedStrategies = new Map()

  function use (strategy, opts) {
    if (usedStrategies.get(strategy)) {
      throw new Error('already using this strategy')
    }

    const install = strategy.install ? strategy.install.bind(strategy) : strategy
    const ret = install(bot, opts)
    const uninstall = ret.uninstall || ret
    if (typeof uninstall !== 'function') {
      throw new Error('strategy installation function must return an uninstall function, or an object with an uninstall function')
    }

    usedStrategies.set(strategy, ret)
    return ret
  }

  function list () {
    return [...usedStrategies.keys()]
  }

  function disable (strategy) {
    const disableFn = usedStrategies.get(strategy)
    if (!disableFn) throw new Error('strategy not enabled')

    disableFn()
    usedStrategies.delete(strategy)
  }

  function clear () {
    list().forEach(disable)
  }

  return {
    use,
    list,
    disable,
    clear
  }
}
