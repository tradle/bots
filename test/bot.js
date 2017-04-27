const crypto = require('crypto')
const test = require('tape')
const {
  co,
  Promise,
  createSimpleMessage,
  shallowExtend
} = require('../lib/utils')

const rawCreateBot = require('../lib/bot')
const TYPE = '_t'

function createBot (opts) {
  opts.inMemory = true
  return rawCreateBot(opts)
}

function noop () {}

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

  bot.start()
  bot.once('sent', co(function* () {
    const history = yield bot.users.history.get('ted')
    t.same(history, [{ object: expected }])
  }))

  bot.send({ userId: expectedTo, object: text })
}))

test('bot.receive', co(function* (t) {
  t.plan(3)
  t.timeoutAfter(500)

  const bot = createBot({
    send: noop
  })

  bot.start()
  const object = createSimpleMessage('hey')
  const message = { object }
  const wrapper = {
    author: 'ted',
    object: message,
    objectinfo: { link: 'something' }
  }

  let i = 0
  let expected = []
  bot.hook.receive(co(function* ({ user, object }) {
    yield checkHistory()
  }))

  bot.hook.postreceive(co(function* ({ user, object }) {
    expected = [
      shallowExtend({
        inbound: true
      }, wrapper)
    ]

    yield checkHistory()
  }))

  // succeed
  bot.receive(wrapper)

  // // fail
  // try {
  //   yield bot.receive(wrapper)
  //   t.fail('received duplicate')
  // } catch (err) {
  //   t.ok(err)
  // }

  bot.on('message', co(function* () {
    checkHistory()
  }))

  bot.on('error', function (err) {
    t.equal(err.action, 'receive')
  })

  const checkHistory = co(function* () {
    t.same(yield bot.users.history.get('ted'), expected)
  })
}))

test('bot.seal', co(function* (t) {
  t.timeoutAfter(500)

  const expected = '74671fb032fffe385e710f2230f4568ccbb1753ced5393e3a00763266051a378'

  let i = 0
  const bot = createBot({
    send: noop,
    seal: function ({ link }) {
      t.equal(link, expected)
      return Promise.resolve()
    }
  })

  const [pushed, wrote, read] = ['push', 'wrote', 'read'].map(event => {
    return new Promise(resolve => bot.seals.once(event, resolve))
  })

  bot.hook.readseal(co(function* ({ link }) {
    t.equal(link, expected)
  }))

  bot.hook.wroteseal(co(function* ({ link }) {
    t.equal(link, expected)
  }))

  bot.seal({ link: expected })
  bot.seal({ link: expected })
    .then(
      () => t.fail('queued duplicate seal'),
      err => t.ok(/exist/.test(err.message))
    )

  yield pushed

  bot.seals.onwrote({ link: expected, txId: 'sometxid' })
  yield wrote

  const sealData = { link: expected, txId: 'sometxid', confirmations: 10 }
  bot.seals.onread(sealData)
  yield read

  t.same(yield bot.seals.get(expected), sealData)
  t.end()
}))

test('presend and prereceive', co(function* (t) {
  const bot = createBot({
    send: t.fail
  })

  const promiseSkipSend = new Promise(resolve => {
    bot.sender.once('skip', resolve)
  })

  const promiseSkipReceive = new Promise(resolve => {
    bot.receiver.once('skip', resolve)
  })

  bot.hook.prereceive(function () {
    return false
  })

  const object = createSimpleMessage('hey')
  const message = { object }
  const wrapper = {
    author: 'ted',
    object: message,
    objectinfo: { link: 'something' }
  }

  yield bot.receive(wrapper)

  bot.hook.presend(function () {
    return false
  })

  yield bot.send({ userId: 'ted', object: {} })
  yield promiseSkipSend
  yield promiseSkipReceive
  t.same(yield bot.users.history.get('ted'), [])

  t.end()
}))
