
const test = require('tape')
const {
  Promise,
  co,
  series
} = require('../lib/utils')

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
