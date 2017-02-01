const test = require('tape')
const express = require('express')
const request = require('superagent')
const bodyParser = require('body-parser')
const createApp = require('../lib/app')
const {
  co,
  createSimpleMessage,
  setDBSchema,
  bigJsonParser
} = require('../lib/utils')

const TRADLE_SERVER_PORT = 27147
const PROVIDER_HANDLE = 'taxtime'
const PROVIDER_URL = `http://localhost:${TRADLE_SERVER_PORT}/${PROVIDER_HANDLE}`
const PORT = 27148
const APP_URL = `http://localhost:${PORT}`

test('send', co(function* (t) {
  const { close, bot } = createApp({
    port: PORT,
    providerURL: PROVIDER_URL
  })

  const payload = createSimpleMessage('hey')
  const message = {
    object: payload
  }

  const tradleServerApp = express()
  tradleServerApp.post(`/${PROVIDER_HANDLE}/message`, bigJsonParser(), function (req, res) {
    t.same(req.body, {
      to: 'ted',
      object: payload
    })

    res.end()
    tradleServer.close()
  })

  tradleServerApp.use(function (err, req, res) {
    t.error(err)
    process.exit(1)
  })

  let tradleServer
  yield new Promise(resolve => {
    tradleServer = tradleServerApp.listen(TRADLE_SERVER_PORT, resolve)
  })

  yield bot.send('ted', 'hey')
  t.same(bot.users.list(), {
    ted: {
      id: 'ted',
      history: [{ payload }]
    }
  })

  close()
  t.end()
}))

test('receive', co(function* (t) {
  const { close, bot } = createApp({
    port: PORT,
    providerURL: PROVIDER_URL
  })

  const payload = createSimpleMessage('hey')
  const message = {
    object: payload
  }

  yield request
    .post(APP_URL)
    .send({
      event: 'message',
      data: {
        author: 'ted',
        object: message
      }
    })

  t.same(bot.users.list(), {
    ted: {
      id: 'ted',
      history: [{ payload, inbound: true }]
    }
  })

  close()
  t.end()
}))
