
# @tradle/bots

a bot framework and sample bot implementations (see [./lib/strategy](./lib/strategy)) for interfacing with a provider running on a Tradle server

The Tradle server takes care of:
- crypto
  - secure line to the user
  - creation/monitoring of blockchain transactions

The Tradle app takes care of:
- cross-platform support (iOS & Android)
- cross-browser support
- messaging UI

This framework supports:
- asynchronous messaging
- reliable persistent-queue-based send/receive on both the server and the bot ends
- easy to get started, see below sample strategy

## Usage

### Strategies

Implementing a strategy for a bot it pretty simple

```js
// ./lib/strategy/echo.js

function echoStrategy (bot) {
  function onmessage ({ userId, payload }) {
    bot.send({ userId, payload })
  }

  bot.on('message', onmessage)

  return function disable () {
    bot.removeListener('message', onmessage)
  }
}

```

### repl

sample session below

```sh
$ ./cmd.js 
Listening on port 8000
🌶  bot.users.list()
{}
🌶  bot.strategies.list()
[ [Function: productsStrategy] ]
🌶  togglePrintReceived()
🌶  // have a user send a message to the provider your bot is hooked up to
🌶  a7d454a8ec9a1bd375f9dd16afdadff9ed8765a03016f6abf7dd10df0f7c8fbe {
  "_s": "CkkKBHAyNTYSQQQkBY3Zz1lTCpyGK4aQzW8mzp8cz7KuvP0U9Km8vddXuL8PFnHpeFN60seFpmvGTAmy0hpA4hg/zQVsYXc2h8kIEkcwRQIgdQy4DkLs3AcYZ+LsbZvEyGNbuLzuyNHri1kWuvN3Su8CIQC6TwkhBqyJn+QG5gUFFFmnxZS+iI0OJ2yQIB4I2dGhbA==",
  "_t": "tradle.CustomerWaiting",
  "_z": "ac1c730a4b803b9cb9ca88c6ed0ddadce06d89e5f881f4c91f76e64050728a4c",
  "message": "Ove has entered the chat",
  "time": 1486070892140
}
🌶  bot.users.list()
{ a7d454a8ec9a1bd375f9dd16afdadff9ed8765a03016f6abf7dd10df0f7c8fbe: 
   { id: 'a7d454a8ec9a1bd375f9dd16afdadff9ed8765a03016f6abf7dd10df0f7c8fbe',
     history: [ [Object], [Object], [Object], [Object], [Object], [Object] ],
     forms: {},
     applications: {},
     products: {},
     importedVerifications: [],
     profile: { firstName: 'Ove' } } }
🌶  bot.send('a7d454a8ec9a1bd375f9dd16afdadff9ed8765a03016f6abf7dd10df0f7c8fbe', 'hey Ove!')
🌶  bot.strategies.clear()
🌶  bot.strategies.list()
[]
🌶  bot.strategies.use(strategies.echo)
```
