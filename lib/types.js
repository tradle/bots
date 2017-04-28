
const typeforce = require('typeforce')

exports.objectMetadata = typeforce.compile({
  author: typeforce.String,
  link: typeforce.String,
  permalink: typeforce.String
})

exports.messageMetadata = typeforce.compile({
  author: typeforce.String,
  recipient: typeforce.String,
  link: typeforce.String,
  permalink: typeforce.String
})

exports.wrapperMetadata = typeforce.compile({
  message: exports.messageMetadata,
  object: exports.objectMetadata
})

exports.wrapperData = typeforce.compile({
  message: typeforce.object,
  object: typeforce.object
})

exports.messageWrapper = typeforce.compile({
  metadata: exports.wrapperMetadata,
  data: exports.wrapperData
})

// exports.messageWrapper = typeforce.compile({
//   message: exports.message,
//   object: exports.objectMetadata
// })
