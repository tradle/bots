const crypto = require('crypto')
const test = require('tape')
const low = require('lowdb')
const createBot = require('../lib/bot')
const {
  co,
  Promise,
  createSimpleMessage,
  shallowExtend
} = require('../lib/utils')

const noop = function () {}

test('bot.send', co(function* (t) {
  t.plan(3)
  t.timeoutAfter(500)

  const text = 'hey'
  const expected = createSimpleMessage(text)
  const expectedTo = 'ted'
  const bot = createBot({
    send: co(function* send ({ userId, object }) {
      t.equal(userId, expectedTo)
      t.same(object, expected)
      return { object }
    })
  })

  bot.once('sent', function () {
    const { history } = bot.users.get('ted')
    t.same(history, [{ object: expected }])
  })

  bot.send({ userId: expectedTo, object: text })
}))

test('bot.receive', co(function* (t) {
  t.plan(2)
  t.timeoutAfter(500)

  const bot = createBot({
    send: noop
  })

  const object = createSimpleMessage('hey')
  const message = { object: object }
  const wrapper = {
    author: 'ted',
    object: message,
    objectinfo: { link: 'something' }
  }

  let i = 0
  bot.addReceiveHandler(co(function* () {
    if (i++ === 0) {
      const { history } = bot.users.get('ted')
      t.same(history, [
        shallowExtend({
          inbound: true
        }, wrapper)
      ])
    } else {
      throw new Error('this error is expected, move along')
    }
  }))

  bot.receive(wrapper)
  bot.receive(wrapper)
  bot.on('error', function (err) {
    t.equal(err.action, 'receive')
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
    return new Promise(resolve => bot.once(event, resolve))
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
