const crypto = require('crypto')
const test = require('tape')
const low = require('lowdb')
const createBot = require('../lib/bot')
const {
  co,
  Promise,
  createSimpleMessage
} = require('../lib/utils')

const noop = function () {}

test('bot.send', co(function* (t) {
  t.plan(3)
  t.timeoutAfter(500)

  const text = 'hey'
  const expected = createSimpleMessage(text)
  const expectedTo = 'ted'
  const bot = createBot({
    send: co(function* send ({ userId, payload }) {
      t.equal(userId, expectedTo)
      t.same(payload, expected)
    })
  })

  bot.once('send:success', function () {
    const { history } = bot.users.get('ted')
    t.same(history, [{ payload: expected }])
  })

  bot.send({ userId: expectedTo, payload: text })
}))

test('bot.receive', co(function* (t) {
  t.plan(1)
  t.timeoutAfter(500)

  const bot = createBot({
    send: noop
  })

  const payload = createSimpleMessage('hey')
  const message = { object: payload }
  bot.addReceiveHandler(function () {
    const { history } = bot.users.get('ted')
    t.same(history, [{ payload, inbound: true }])
  })

  bot.receive({
    author: 'ted',
    object: message
  })
}))

test('bot.seal', co(function* (t) {
  t.plan(4)
  t.timeoutAfter(500)

  const expected = crypto.randomBytes(32).toString('hex')
  const bot = createBot({
    send: noop,
    seal: function ({ link }) {
      t.equal(link, expected)
      return Promise.resolve()
    }
  })

  const [pushed, wrote, read] = ['seal:push', 'seal:wrote', 'seal:read'].map(event => {
    return new Promise(resolve => bot.seals.once(event, resolve))
  })

  bot.seals.addOnReadHandler(co(function* ({ link }) {
    t.equal(link, expected)
  }))

  bot.seals.addOnWroteHandler(co(function* ({ link }) {
    t.equal(link, expected)
  }))

  bot.seals.seal({ link: expected })
  yield pushed

  bot.seals.onwrote({ link: expected, txId: 'sometxid' })
  yield wrote

  const sealData = { link: expected, txId: 'sometxid', confirmations: 10 }
  bot.seals.onread(sealData)
  yield read

  t.same(bot.seals.get(expected), sealData)
  t.end()
}))
