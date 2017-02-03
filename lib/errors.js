const NOT_FOUND = 'NotFound'
const DUPLICATE = 'Duplicate'

exports.notFound = createError(NOT_FOUND)
exports.duplicate = createError(DUPLICATE)

exports.isNotFound = function (err) {
  return err.type === NOT_FOUND
}

exports.isDuplicate = function (err) {
  return err.type === DUPLICATE
}

function createError (type) {
  return function (err) {
    if (typeof err === 'string') err = new Error(err)

    err.type = type
    return err
  }
}
