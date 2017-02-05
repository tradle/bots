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
    conf: './conf/silly.json'
  }
})

const debug = require('debug')('tradle:bot:scaffold')
const conf = require(argv.conf)
const app = require('./lib/app')(conf)
const { bot } = app

debug('Listening on port ' + conf.port)
debug('Databases will be stored in ' + conf.dir)

if (conf.strategies) {
  conf.strategies.forEach(path => {
    debug('Using strategy from ' + path)
    bot.strategies.use(require(path))
  })
}

if (String(conf.repl) !== 'false') {
  const pepperIcon = '\uD83C\uDF36  '
  const prompt = typeof conf.repl === 'string' ? conf.repl : pepperIcon
  require('./lib/repl')({ prompt, app })
}
