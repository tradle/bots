const typeforce = require('typeforce')

const NOT_FOUND = 'NotFound'
const DUPLICATE = 'Duplicate'
const DEVELOPER = 'Developer'
const USER_NOT_FOUND = 'UserNotFound'
const DEVELOPER_ERRORS = [
  ReferenceError,
  SyntaxError,
  TypeError,
  RangeError,
  typeforce.TfTypeError,
  typeforce.TfPropertyTypeError
]

exports.notFound = createError(NOT_FOUND)
exports.duplicate = createError(DUPLICATE)
exports.developer = createError(DEVELOPER)
exports.userNotFound = createError(USER_NOT_FOUND)

const SKIP_RECEIVE = new Error('skip receive')

exports.isProbablyDeveloperError = function (err) {
  return DEVELOPER_ERRORS.some(ctor => err instanceof ctor)
}

exports.isNotFoundError = function (err) {
  return err.type === NOT_FOUND
}

exports.isDuplicateError = function (err) {
  return err.type === DUPLICATE
}

exports.isDeveloperError = function (err) {
  return err.type === DEVELOPER
}

exports.isUserNotFoundError = function (err) {
  return err.type === USER_NOT_FOUND
}

exports.isUnknownIdentityError = function (err) {
  const message = err.body && err.body.message || err.message
  return /unknown identity/i.test(message)
}

exports.forAction = function (err, action) {
  if (typeof err === 'string') err = new Error(err)
  err.action = action
  return err
}

exports.skipReceive = function () {
  return SKIP_RECEIVE
}

exports.isSkipReceive = function (err) {
  return err === SKIP_RECEIVE
}

function createError (type) {
  return function (err) {
    if (typeof err === 'string') err = new Error(err)

    err.type = type
    return err
  }
}
