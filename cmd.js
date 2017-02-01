#!/usr/bin/env node

const argv = require('minimist')(process.argv.slice(2), {
  alias: {
    t: 'tradle-server',
    p: 'port',
    r: 'repl'
  },
  default: {
    repl: true,
    port: 8000,
    'tradle-server': 'http://localhost:44444'
  }
})

const { bot } = require('./lib/app')({
  tradleServerURL: argv['tradle-server'],
  port: argv.port,
  dbPath: './db.json'
})

console.log('Listening on port ' + argv.port)

if (String(argv.repl) !== 'false') {
  const pepper = '\uD83C\uDF36  '
  const prompt = typeof argv.repl === 'string' ? argv.repl : pepper
  require('./lib/repl')({ prompt, bot })
}
