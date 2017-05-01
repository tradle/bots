const typeforce = require('typeforce')
const SEQ = '_n'
const SIG = '_s'

exports.payloadMetadata = typeforce.compile({
  link: typeforce.String,
  permalink: typeforce.String,
  author: typeforce.maybe(typeforce.String)
})

exports.messageMetadata = typeforce.compile({
  author: typeforce.String,
  recipient: typeforce.String,
  link: typeforce.String,
  permalink: typeforce.String
})

exports.wrapperMetadata = typeforce.compile({
  message: exports.messageMetadata,
  payload: exports.payloadMetadata
})

exports.message = typeforce.compile({
  // [SEQ]: typeforce.Number,
  object: typeforce.Object,
  [SIG]: typeforce.maybe(typeforce.String)
})

exports.messageWrapper = typeforce.compile({
  metadata: exports.wrapperMetadata,
  message: exports.message
})

// exports.messageWrapper = typeforce.compile({
//   message: exports.message,
//   object: exports.payloadMetadata
// })
