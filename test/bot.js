const crypto = require('crypto')
const test = require('tape')
const {
  co,
  Promise,
  createSimpleMessage,
  shallowExtend,
  omit
} = require('../lib/utils')

const { fakeWrapper } = require('./utils')
const { loudCo } = require('./utils')

const rawCreateBot = require('../lib/bot')
const { TYPE, SIG } = require('../lib/constants')

function createBot (opts) {
  opts.inMemory = true
  return rawCreateBot(opts)
}

function noop () {}

test('bot.send', loudCo(function* (t) {
  const from = 'bill'
  const to = 'ted'
  const cc = 'rufus'
  const text = 'hey'
  const expected = createSimpleMessage(text)
  let resp
  const bot = createBot({
    send: co(function* ({ userId, object }) {
      if (object[SIG]) {
        t.equal(userId, cc)
        t.same(omit(object, [SIG]), expected)
      } else {
        t.equal(userId, to)
        t.same(object, expected)
      }

      return resp = fakeWrapper({ from, to, object })
    })
  })

  bot.send({ userId: to, object: text })
  bot.once('sent', co(function* ({ wrapper }) {
    const { object } = wrapper.message
    const history = yield bot.users.history.dump('ted')
    t.same(history, [resp])

    // cc rufus
    bot.send({ userId: cc, object })

    bot.once('sent', co(function* ({ wrapper }) {
      const { object } = wrapper.message
      const history = yield bot.users.history.dump('rufus')
      t.same(history, [resp])
      t.end()
    }))
  }))

}))

test('bot.receive', loudCo(function* (t) {
  t.plan(3)
  t.timeoutAfter(500)

  const bot = createBot({
    send: noop
  })

  const object = createSimpleMessage('hey')
  const message = { object }
  const from = 'ted'
  const to = 'bill'
  const wrapper = fakeWrapper({ from, to, object })

  let i = 0
  let expected = []

  const checkHistory = co(function* () {
    t.same(yield bot.users.history.dump('ted'), expected)
  })

  bot.hook('receive', checkHistory)

  bot.hook('postreceive', co(function* () {
    expected = [
      shallowExtend(wrapper, {
        metadata: shallowExtend(wrapper.metadata, {
          message: shallowExtend(wrapper.metadata.message, {
            inbound: true
          })
        })
      })
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
}))

test('bot.seal', loudCo(function* (t) {
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

  bot.hook('readseal', co(function* ({ link }) {
    t.equal(link, expected)
  }))

  bot.hook('wroteseal', co(function* ({ link }) {
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

test('presend and prereceive', loudCo(function* (t) {
  const bot = createBot({
    send: t.fail
  })

  const promiseSkipSend = new Promise(resolve => {
    bot.sender.once('skip', resolve)
  })

  const promiseSkipReceive = new Promise(resolve => {
    bot.receiver.once('skip', resolve)
  })

  bot.hook('prereceive', function () {
    return false
  })

  const object = createSimpleMessage('hey')
  const from = 'ted'
  const to = 'bill'
  const wrapper = fakeWrapper({ from, to, object })

  yield bot.receive(wrapper)

  bot.hook('presend', function () {
    return false
  })

  yield bot.send({ userId: 'ted', object: {} })
  yield promiseSkipSend
  yield promiseSkipReceive
  t.same(yield bot.users.history.dump('ted'), [])

  t.end()
}))

test('delete user, clear history', loudCo(function* (t) {
  const text = 'hey'
  const expected = createSimpleMessage(text)
  const from = 'bill'
  const to = 'ted'
  let resp
  const bot = createBot({
    send: co(function* send ({ userId, object }) {
      return resp = fakeWrapper({ from, to, object })
    })
  })

  bot.once('sent', co(function* () {
    let history = yield bot.users.history.dump('ted')
    t.same(history, [resp])
    yield bot.users.del('ted')
    history = yield bot.users.history.dump('ted')
    t.same(history, [])
    t.end()
  }))

  bot.send({ userId: to, object: text })
}))
