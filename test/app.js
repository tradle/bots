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

let availablePort = 27147
const PROVIDER_HANDLE = 'taxtime'

function nextSettings () {
  const app = { port: ++availablePort }
  app.url = `http://localhost:${availablePort}`

  const tradleServer = { port: ++availablePort }
  tradleServer.providerURL = `http://localhost:${availablePort}/${PROVIDER_HANDLE}`

  return { app, tradleServer }
}

test('send', co(function* (t) {
  t.timeoutAfter(500)

  const settings = nextSettings()
  const { close, bot } = createApp({
    port: settings.app.port,
    providerURL: settings.tradleServer.providerURL
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
    tradleServer = tradleServerApp.listen(settings.tradleServer.port, resolve)
  })

  bot.once('send:success', co(function* () {
    t.same(bot.users.list(), {
      ted: {
        id: 'ted',
        history: [{ payload }]
      }
    })

    close()
    t.end()
  }))

  bot.send({ userId: 'ted', payload: 'hey' })
}))

test('receive', co(function* (t) {
  t.timeoutAfter(500)

  const settings = nextSettings()
  const { close, bot } = createApp({
    port: settings.app.port,
    providerURL: settings.tradleServer.providerURL
  })

  const payload = createSimpleMessage('hey')
  const message = {
    object: payload
  }

  bot.addReceiveHandler(function () {
    t.same(bot.users.list(), {
      ted: {
        id: 'ted',
        history: [{ payload, inbound: true }]
      }
    })

    close()
    t.end()
  })

  yield request
    .post(settings.app.url)
    .send({
      event: 'message',
      data: {
        author: 'ted',
        object: message
      }
    })
}))
