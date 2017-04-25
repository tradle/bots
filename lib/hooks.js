const {
  addAndRemover
} = require('./utils')

module.exports = function createHooks (obj) {
  const hooks = {}
  Object.keys(obj).forEach(key => {
    const val = obj[key]
    if (Array.isArray(val)) {
      hooks[key] = addAndRemover(val)
      return
    }

    hooks[key] = createHooks(val)
  })

  return hooks
}
