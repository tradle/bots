const test = require('tape')
const {
  clone
} = require('../lib/utils')

const { loudCo } = require('./utils')
const createHistories = require('../lib/history')
const levelup = require('../lib/levelup')

test('basic', loudCo(function* (t) {
  const db = levelup('./historytest', true)
  const histories = createHistories({ db })
  const bill = [
    { a: 1 },
    { b: 2 },
  ].map(wrap)

  const ted = [
    { c: 1 },
    { d: 2 },
  ].map(wrap)

  const billExpected = bill.map(getExpected)
  const tedExpected = ted.map(getExpected)

  yield Promise.all(bill.map(item => histories.append({ userId: 'bill', item: clone(item) })))
  t.equal(yield histories.length('bill'), 2)
  t.same(yield histories.get({ userId: 'bill', index: 1 }), billExpected[1])
  t.same(yield histories.dump('bill'), billExpected)
  t.equal(yield histories.length('ted'), 0)

  yield Promise.all(ted.map(item => histories.append({ userId: 'ted', item: clone(item) })))
  t.equal(yield histories.length('bill'), 2)
  t.equal(yield histories.length('ted'), 2)
  t.same(yield histories.dump('ted'), tedExpected)
  t.end()
}))

function wrap (obj) {
  return {
    metadata: {},
    message: {
      object: { object: obj }
    }
  }
}

function getExpected (item, i) {
  const copy = clone(item)
  copy.metadata.index = i
  return copy
}
