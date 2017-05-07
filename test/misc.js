const test = require('tape')
const {
  Promise,
  promisifyAll,
  co,
  series,
  bubble,
  wait
} = require('../lib/utils')

const createLocker = require('../lib/locker')
const createStore = require('../lib/store')
const cachify = require('../lib/cachify')
const PromiseEmitter = require('../lib/promise-emitter')
const levelup = require('../lib/levelup')
const createHooks = require('../lib/hooks')

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

test('bubble', co(function* (t) {
  let ran = 0
  yield bubble([
    () => {
      t.equal(ran++, 0)
      return Promise.resolve()
    },
    () => {
      t.equal(ran++, 1)
      t.pass()
    },
    () => Promise.resolve(false),
    () => t.fail('should not have been called'),
  ])

  t.equal(ran, 2)
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

test('promise emitter', co(function* (t) {
  const emitter = new PromiseEmitter()

  const expectedArgs = [1, 2, 3]

  let called = 0
  emitter.on('a', function (...args) {
    t.equal(called++, 0)
    t.same(args, expectedArgs)
    return new Promise(resolve => setTimeout(resolve, 100))
  })

  emitter.on('a', function (...args) {
    t.equal(called++, 1)
    t.same(args, expectedArgs)
  })

  yield emitter.emit('a', ...expectedArgs)
  t.equal(called, 2)

  emitter.removeAllListeners()
  emitter.on('a', function () {
    return Promise.reject(new Error('async'))
  })

  try {
    yield emitter.emit('a')
  } catch (err) {
    t.equal(err.message, 'async')
  }

  emitter.on('b', function () {
    t.pass()
    t.end()
  })

  // should not remove 'b' listener
  emitter.removeAllListeners('a')
  emitter.on('a', function () {
    throw new Error('sync')
  })

  try {
    yield emitter.emit('a')
  } catch (err) {
    t.equal(err.message, 'sync')
  }

  emitter.emit('b')
}))

test('recreate levelup', co(function* (t) {
  let db = levelup('./blah.db', true)
  promisifyAll(db)
  yield db.putAsync('a', 'b')
  t.equal(yield db.getAsync('a'), 'b')
  yield db.destroyAsync()
  db = levelup('./blah.db', true)
  try {
    yield db.get('a')
    t.fail('db should be empty')
  } catch (err) {
    t.ok(err)
  }

  t.end()
}))

test('hooks', co(function* (t) {
  const hooks = createHooks()
  const fired = {}
  const aArgs = [1, 2]

  let defaultOn = true
  yield new Promise(resolve => {
    hooks.default('a', function () {
      t.equal(defaultOn, true)
      resolve()
    })

    hooks.fire('a', 1)
  })

  defaultOn = false
  hooks.hook('a', function (...args) {
    t.same(args, aArgs)
    fired['a'] = true
    // prevent subsequent handlers
    return false
  })

  const promiseA = new Promise(resolve => hooks.once('a', (...args) => resolve(args)))
  yield hooks.fire('a', ...aArgs)
  t.ok(fired['a'])
  t.same(yield promiseA, aArgs)

  // will not fire if bubble() is used because `false` is returned
  // in the previous handler
  hooks.hook('a', function (...args) {
    t.fail('should have been prevented')
  })

  hooks.on('a', t.fail)
  yield hooks.bubble('a', ...aArgs)

  t.end()
}))
