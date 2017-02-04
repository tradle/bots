# tiny crash course in Promises

if you're completely unfamiliar with Promises, there's a million decent intros online, e.g.:

https://github.com/mattdesl/promise-cookbook  
https://developers.google.com/web/fundamentals/getting-started/primers/promises

but in short, Promises let you turn asynchronous code like this...

```js
function doChores (cb) {
  watchNews(function (err, news) {
    if (err) return cb()

    tellGrandma(news, function (err) {
      if (err) return cb()

      readBook(function (err, summary) {
        if (err) throw err;

        tellGrandma(summary, cb)
      })
    })
  })

  // the code here will run before watchNews is done
  // this can get confusing...
}
```

...into asynchronous, but *synchronous-looking* code like this, where you can use return values instead of callbacks...

```js
function doChores () {
  return watchNews()
    .then(tellGrandma)
    .then(readBook)
    .then(tellGrandma)
}
```

This can still be a pain because you can't use if/else try/catch, and other control flow logic to perform asynchronous tasks without peppering `then()/catch()` everywhere and losing scope. Luckily, until the holy grail of `async/await` gets support in all environments, you can use [bluebird](https://github.com/petkaantonov/bluebird)'s coroutine method or the [co](https://github.com/tj/co) library to turn the previous code into this:

```js
const co = require('bluebird').coroutine
const doChores = co(function* doChores () {}
  const news = yield watchNews()
  yield tellGrandma(news)
  const summary = yield readBook()
  yield tellGrandma(book)
})
```

This is awesome! You're running asynchronous code without breaking your code logic. You can use regular try/catch, regular if/else, regular loops, etc.:

```js
co(function* () {
  for (var i = 0; i < 10; i++) {
    if (i % 2) yield wait(100)
  }

  try {
    yield doSomethingDangerous()
  } catch (err) {
    yield reportCatastrophicFailure(err)
  }
})

function wait (millis) {
  return new Promise(resolve => setTimeout(resolve, millis))
}
```

Note: a function constructed with `co` returns a Promise no matter what's inside it
