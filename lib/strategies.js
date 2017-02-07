
module.exports = function manageStrategies (bot) {
  const usedStrategies = new Map()

  function use (strategy, args) {
    if (usedStrategies.get(strategy)) {
      throw new Error('already using this strategy')
    }

    const install = strategy.install ? strategy.install.bind(strategy) : strategy
    const disable = install(bot, args)
    if (typeof disable !== 'function') {
      throw new Error('strategy installation function should return a function that disables the strategy')
    }

    usedStrategies.set(strategy, disable)
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
