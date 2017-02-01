#!/usr/bin/env node

const argv = require('minimist')(process.argv.slice(2), {
  alias: {
    c: 'conf',
  },
  default: {
    conf: './sample-conf.json'
  }
})

const conf = require(argv.conf)
const { bot } = require('./lib/app')(conf)

console.log('Listening on port ' + conf.port)

if (conf.strategy) {
  const installStategy = require(conf.strategy)
  installStategy(bot)
}

if (String(conf.repl) !== 'false') {
  const pepper = '\uD83C\uDF36  '
  const prompt = typeof conf.repl === 'string' ? conf.repl : pepper
  require('./lib/repl')({ prompt, bot })
}
