const querystring = require('querystring')
const debug = require('debug')('tradle:bots:app')
const request = require('superagent')
const express = require('express')
const rawCoExpress = require('co-express')

const createBot = require('./bot')
const {
  Promise,
  co,
  bigJsonParser,
  sendRequest,
  normalizeConf
} = require('./utils')

const coExpress = gen => rawCoExpress(gen, co)

module.exports = function createApp (conf) {
  // trim trailing slashes
  const { port, webhookURL, providerURL, dir, autostart } = normalizeConf(conf)
  const { providerHandle } = parseProviderUrl(providerURL)

  const app = express()
  app.get('/', function (req, res) {
    res.send('this is samplebot. Over.')
  })

  // bot shouldn't need to worry about the transport mechanism
  const botOpts = {
    inMemory: conf.inMemory,
    autostart,
    dir,
    /**
     * @return {Promise}
     */
    send: co(function* send ({ userId, object, other={} }) {
      const data = {
        to: userId,
        object: object
      }

      if (Object.keys(other).length !== 0) {
        data.other = other
      }

      return post({
        path: '/message',
        data
      })
    }),

    /**
     * @return {Promise}
     */
    seal: co(function* seal ({ link }) {
      return post({ path: `/seal/${link}` })
    })
  }

  if (conf.store) {
    botOpts.createStore = typeof conf.store === 'string'
      ? require(conf.store)
      : conf.store
  }

  const bot = createBot(botOpts)

  function post ({ path, data }) {
    // trim leading slashes
    path = path.replace(/^\/+/g, '')
    const url = `${providerURL}/${path}`
    const req = request
      .post(url)
      .send(data)

    debug('POSTing to ' + url)
    return sendRequest(req)
  }

  const health = co(function* () {
    const query = querystring.stringify({ webhook: webhookURL })
    const req = request(`${providerURL}/health?${query}`)
    try {
      yield sendRequest(req)
    } catch (err) {
      debug('failed to make roundtrip health check.')
      if (/webhook.*?found/.test(err.message)) {
        debug('Error: did you forget to add a webhook on the tradle server?')
        debug(`add a webhook to your tradle server with: newwebhook ${providerHandle} ${webhookURL}`)
      } else if (err.code === 'ECONNREFUSED') {
        debug('Error: can\'t reach Tradle server')
      } else {
        debug('Error: your webhook may be misconfigured')
      }

      throw err
    }
  })

  // SAMPLE 'MESSAGE' EVENT
  // see https://github.com/tradle/server-cli#sample
  //
  // {
  //   "event": "message",
  //   "data": {
  //     "objectinfo": {
  //       "author": "7f358ce8842a2a0a1689ea42003c651cd99c9a618d843a1a51442886e3779411",
  //       "link": "37ae88728b3ba0bdecbaabd55e2368e28d5d7bbd8934f52091b99abacd83e039",
  //       "permalink": "37ae88728b3ba0bdecbaabd55e2368e28d5d7bbd8934f52091b99abacd83e039",
  //       "type": "tradle.ProductApplication"
  //     },
  //     "recipient": "ef78b341f079cf4245faf23e79058992a337313080b264d476c7952d37d32462",
  //     "author": "7f358ce8842a2a0a1689ea42003c651cd99c9a618d843a1a51442886e3779411",
  //     "permalink": "19066616c29937dbfd8fff44d0d6ba122cb8cbf1c9cd16abc616dc773e37af79",
  //     "link": "19066616c29937dbfd8fff44d0d6ba122cb8cbf1c9cd16abc616dc773e37af79",
  //     "type": "tradle.Message",
  //     "seq": 0,
  //     "archived": false,
  //     "timestamp": 1478609547888,
  //     "_": 6,
  //     "object": {
  //       "recipientPubKey": {
  //         "curve": "p256",
  //         "pub": Buffer
  //       },
  //       "object": {
  //         "_s": "CikKBHAyNTYSIQLRuoI9w4Pk8cbsPz49STEw5l4HURsZdlPiXwdbbfjM4hJHMEUCIC7KAygKV2ly8syhkna0OXr3WAbT6gTVU0VHuMxceRhpAiEAl4OHLWACgHrf+G+OG7zUvnBLehIsF1nU8KCMaXk/lCo=",
  //         "_t": "tradle.ProductApplication",
  //         "product": "tradle.CurrentAccount"
  //       },
  //       "_s": "CikKBHAyNTYSIQLRuoI9w4Pk8cbsPz49STEw5l4HURsZdlPiXwdbbfjM4hJGMEQCIHTHXBBeLOApDfEglmyOd1IPqVjMlIt14bXTiyONgZ9DAiB+UTkUZGliCMihIJqnevmyt1zAhTVYsIzDI6pB6VRrOQ==",
  //       "_n": 0,
  //       "_t": "tradle.Message"
  //     }
  //   }
  // }

  // bigJsonParser as we might be getting inlined images
  app.post('/', bigJsonParser(), coExpress(function* (req, res) {
    const { event, data } = req.body
    debug(`received a "${event}" event webhook POST`)
    switch (event) {
      case 'message':
        yield bot.receive(data)
        break
      case 'readseal':
        yield bot.seals.onread(data)
        break
      case 'wroteseal':
        yield bot.seals.onwrote(data)
        break
      case 'health':
        break
      default:
        debug(`don't know how to handle "${event}" events`)
        break
    }

    res.end()
  }))

  app.use(function defaultErrHandler (err, req, res, next) {
    debug(`caught error in default handler: ${err.stack}`)
    res.status(500).end()
  })

  const server = app.listen(port)
  const close = Promise.promisify(server.close.bind(server))

  return {
    server,
    bot,
    close,
    health
  }

  function parseProviderUrl (providerURL) {
    const match = providerURL.match(/(https?:\/\/[^/]+)\/([a-zA-Z-_]+)/)
    if (!match) throw new Error('unexpected format for "providerURL"')

    const [ignore, tradleServerURL, providerHandle] = match
    return { tradleServerURL, providerHandle }
  }
}
