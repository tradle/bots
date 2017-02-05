#!/usr/bin/env node

try {
  const SegfaultHandler = require('segfault-handler')
  SegfaultHandler.registerHandler("crash.log")
} catch (err) {}

// load .env
require('dotenv').config()

const argv = require('minimist')(process.argv.slice(2), {
  alias: {
    c: 'conf',
  },
  default: {
    conf: './sample-conf.json'
  }
})

const conf = require(argv.conf)
const app = require('./lib/app')(conf)
const { bot } = app

console.log('Listening on port ' + conf.port)

if (conf.strategies) {
  conf.strategies.forEach(path => {
    bot.strategies.use(require(path))
  })
}

if (String(conf.repl) !== 'false') {
  const pepperIcon = '\uD83C\uDF36  '
  const prompt = typeof conf.repl === 'string' ? conf.repl : pepperIcon
  require('./lib/repl')({ prompt, app })
}
