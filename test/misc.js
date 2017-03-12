const test = require('tape')
const {
  Promise,
  co,
  series,
  wait
} = require('../lib/utils')

const createLocker = require('../lib/locker')
const createStore = require('../lib/store')
const cachify = require('../lib/cachify')

test('cachify', co(function* (t) {
  const store = createStore({ inMemory: true })
  const cachified = cachify({ store })
  const { get } = store
  store.get = t.fail
  yield cachified.set('a', 'b')
  t.equal(yield cachified.get('a'), 'b')
  t.equal(yield get('a'), 'b')
  cachified.set('a', 'c')
  t.equal(yield cachified.get('a'), 'c')
  t.equal(yield get('a'), 'c')

  store.get = get
  yield cachified.del('a')
  try {
    yield cachified.get('a')
    t.fail('failed to delete key')
  } catch (err) {
    t.ok(err)
  }

  t.end()
}))

test('series', co(function* (t) {
  // t.plan(6)

  let i = 0
  const fns = [
    () => new Promise(resolve => {
      setTimeout(() => {
        t.equal(i++, 0)
        resolve(i, 100)
      })
    }),
    () => new Promise(resolve => {
      setTimeout(() => {
        t.equal(i++, 1)
        resolve(i, 50)
      })
    })
  ]

  // succeed
  yield series(fns)

  // fail asynchronously
  i = 0
  fns.push(() => new Promise((resolve, reject) => {
    setTimeout(() => {
      t.equal(i++, 2)
      reject(new Error('' + i), 10)
    })
  }))

  try {
    yield series(fns)
  } catch (err) {
    t.equal(Number(err.message), 3)
  }

  // fail synchronously
  i = 0
  fns.pop()
  fns.push(() => {
    throw new Error('' + i)
  })

  try {
    yield series(fns)
  } catch (err) {
    t.equal(Number(err.message), 2)
  }

  t.end()
}))

test('lock', co(function* (t) {
  const lock = createLocker()
  const unlockA = yield lock('a')
  let unlockedA
  lock('a')
    .then(() => {
      t.equal(unlockedA, true)
      t.end()
    })
    .catch(t.error)

  // can lock on another id
  const unlockB = yield lock('b')
  yield wait(100)
  unlockedA = true
  unlockA()
}))

test('lock timeout', co(function* (t) {
  // prevent exit
  const timeout = setTimeout(() => {}, 1000)

  const lock = createLocker({ timeout: 100 })
  yield lock('a')
  const start = Date.now()
  yield lock('a')
  const time = Date.now() - start
  t.ok(time > 50)
  t.end()

  clearTimeout(timeout)
}))
