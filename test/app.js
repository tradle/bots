const test = require('tape')
const express = require('express')
const request = require('superagent')
const BASE_STRATEGY = require('../lib/strategy/base')
const {
  co,
  createSimpleMessage,
  bigJsonParser,
  shallowExtend
} = require('../lib/utils')

const rawCreateApp = require('../lib/app')
const { TYPE } = require('../lib/constants')

function createApp (conf) {
  conf.inMemory = true
  return rawCreateApp(conf)
}

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
    autostart: true,
    port: settings.app.port,
    providerURL: settings.tradleServer.providerURL
  })

  disableNonBaseStrategies(bot)

  const from = 'bill'
  const to = 'ted'
  const object = createSimpleMessage('hey')
  const tradleServerApp = express()
  const resp = {
    message: {
      author: from,
      recipient: to,
      link: 'abc',
      permalink: 'abc',
      object: {
        [TYPE]: 'tradle.Message',
        object: shallowExtend({ _s: 'some other sig' }, object)
      }
    },
    object: {
      author: from,
      link: 'efg',
      permalink: 'efg'
    }
  }

  tradleServerApp.post(`/${PROVIDER_HANDLE}/message`, bigJsonParser(), function (req, res) {
    t.same(req.body, { to, object })
    res.json(resp)
  })

  tradleServerApp.use(function (err, req, res, next) {
    t.error(err)
    process.exit(1)
  })

  let tradleServer
  yield new Promise(resolve => {
    tradleServer = tradleServerApp.listen(settings.tradleServer.port, resolve)
  })

  bot.once('sent', co(function* () {
    t.same(yield bot.users.list(), [{
      key: 'ted',
      value: {
        id: 'ted'
      }
    }])

    tradleServer.close()
    close()
    t.end()
  }))

  bot.send({ userId: 'ted', object: 'hey' })
}))

test('receive', co(function* (t) {
  t.timeoutAfter(500)

  const settings = nextSettings()
  const { close, bot } = createApp({
    dir: 'test.app.receive',
    autostart: true,
    port: settings.app.port,
    providerURL: settings.tradleServer.providerURL
  })

  disableNonBaseStrategies(bot)

  const object = createSimpleMessage('hey')
  const message = {
    [TYPE]: 'tradle.Message',
    object
  }

  const wrapper = {
    // index: 0,
    message: {
      author: 'ted',
      recipient: 'bill',
      object: message,
      link: 'abc',
      permalink: 'abc',
    },
    object: {
      author: 'ted',
      link: 'efg',
      permalink: 'efg'
    }
  }

  bot.on('message', co(function* ({ user, object }) {
    t.same(yield bot.users.list(), [{
      key: 'ted',
      value: {
        id: 'ted'
      }
    }])

    close()
    t.end()
  }))

  yield request
    .post(settings.app.url)
    .send({
      event: 'message',
      data: wrapper
    })
}))

function disableNonBaseStrategies (bot) {
  bot.strategies.list().forEach(strategy => {
    if (strategy !== BASE_STRATEGY) {
      bot.strategies.disable(strategy)
    }
  })
}
