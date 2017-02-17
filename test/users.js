
const test = require('tape')
const {
  co,
  shallowClone
} = require('../lib/utils')

const Store = require('@tradle/kv').wrap(require('@tradle/kv-levelup'))
const manageUsers = require('../lib/users')

test('users', co(function* (t) {
  const store = Store.wrap({ store: lowStore() })
  const users = manageUsers({ store })
  t.same(yield users.list(), [])

  const key = 'ted'
  const ted = { name: key }
  yield users.create(key, ted)

  let expected = {
    id: key,
    name: key,
    history: []
  }

  t.same(yield users.list(), [{ key, value: expected }])

  try {
    yield users.create(key)
    t.fail('clobbered existing user')
  } catch (err) {
    t.ok(/exists/.test(err.message))
  }

  const update = shallowClone(expected)
  update.likes = 'stuff'
  yield users.save(update)
  t.same(yield users.list(), [{
    key: key,
    value: shallowClone(expected, update)
  }])

  yield users.del(key)
  t.same(yield users.list(), [])

  yield users.create(key, ted)
  t.same(yield users.list(), [{ key, value: expected }])

  yield users.clear()
  t.same(yield users.list(), [])

  t.end()
}))
