const NOT_FOUND = 'NotFound'
const DUPLICATE = 'Duplicate'
const DEVELOPER = 'Developer'

exports.notFound = createError(NOT_FOUND)
exports.duplicate = createError(DUPLICATE)
exports.developer = createError(DEVELOPER)

exports.isNotFoundError = function (err) {
  return err.type === NOT_FOUND
}

exports.isDuplicateError = function (err) {
  return err.type === DUPLICATE
}

exports.isDeveloperError = function (err) {
  return err.type === DEVELOPER
}

exports.forAction = function (err, action) {
  if (typeof err === 'string') err = new Error(err)
  err.action = action
  return err
}

function createError (type) {
  return function (err) {
    if (typeof err === 'string') err = new Error(err)

    err.type = type
    return err
  }
}
