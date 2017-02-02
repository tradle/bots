const test = require('tape')
const low = require('lowdb')
const createBot = require('../lib/bot')
const {
  co,
  createSimpleMessage,
  setDBSchema
} = require('../lib/utils')

const noop = function () {}

test('bot.send', co(function* (t) {
  t.plan(3)
  t.timeoutAfter(500)

  const text = 'hey'
  const expected = createSimpleMessage(text)
  const expectedTo = 'ted'
  const bot = createBot({
    send: co(function* send (to, data) {
      t.equal(to, expectedTo)
      t.same(data, expected)
    })
  })

  bot.once('sent', function () {
    const { history } = bot.users.get('ted')
    t.same(history, [{ payload: expected }])
  })

  bot.send(expectedTo, text)
}))

test('bot.receive', co(function* (t) {
  t.plan(1)
  t.timeoutAfter(500)

  const bot = createBot({
    send: noop
  })

  const payload = createSimpleMessage('hey')
  const message = { object: payload }
  bot.once('message', function () {
    const { history } = bot.users.get('ted')
    t.same(history, [{ payload, inbound: true }])
  })

  bot.receive({
    author: 'ted',
    object: message
  })
}))

function createDB() {
  return setDBSchema(low())
}
