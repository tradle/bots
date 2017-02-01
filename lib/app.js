
const debug = require('debug')('samplebot:app')
const request = require('superagent')
const low = require('lowdb')
const express = require('express')
// we might be getting images
const createBot = require('./bot')
const {
  co,
  bigJsonParser,
  sendRequest
} = require('./utils')

module.exports = function createApp ({ port, providerURL, dbPath }) {
  // trim trailing slashes
  providerURL = providerURL.replace(/\/+$/, '')

  const app = express()
  const bot = createBot({
    db: low(dbPath),
    /**
     * @return {Promise}
     */
    send: co(function* send (user, payload) {
      const url = `${providerURL}/message`
      debug('POSTing to ' + url)
      const req = request
        .post(url)
        .send({
          to: user.id || user,
          object: payload
        })

      return sendRequest(req)
    })
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

  app.post('/', bigJsonParser(), co(function* (req, res) {
    const { event, data } = req.body
    switch (event) {
      case 'message':
        yield bot.receive(data)
        break
      case 'readseal':
      case 'wroteseal':
        // TODO: something
        break
    }

    res.end()
  }))

  app.post('/message', bigJsonParser(), co(function* (req, res) {
    yield bot.receive(req.body)
    res.end()
  }))

  app.use(function defaultErrHandler (err, req, res, next) {
    debug(`caught error in default handler: ${err.stack}`)
    res.end()
  })

  const server = app.listen(port)
  return {
    server,
    bot,
    close: server.close.bind(server)
  }
}
