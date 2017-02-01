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

  const text = 'hey'
  const expected = createSimpleMessage(text)
  const expectedTo = 'ted'
  const bot = createBot({
    db: low(),
    send: co(function* send (to, data) {
      t.equal(to, expectedTo)
      t.same(data, expected)
    })
  })

  yield bot.send(expectedTo, text)
  const { history } = bot.users.get('ted')
  t.same(history, [{ payload: expected }])
}))

test('bot.receive', co(function* (t) {
  t.plan(1)

  const bot = createBot({
    db: low(),
    send: noop
  })

  const payload = createSimpleMessage('hey')
  const message = { object: payload }
  yield bot.receive({
    author: 'ted',
    object: message
  })

  const { history } = bot.users.get('ted')
  t.same(history, [{ payload, inbound: true }])
}))

function createDB() {
  return setDBSchema(low())
}
