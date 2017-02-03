# @tradle/bots

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->


- [What the bot is this?](#what-the-bot-is-this)
- [Terms](#terms)
    - [Provider](#provider)
- [Usage](#usage)
  - [Environment](#environment)
  - [Run your Tradle server](#run-your-tradle-server)
  - [Get started](#get-started)
  - [Console](#console)
    - [Sample Session](#sample-session)
    - [Console globals](#console-globals)
  - [Strategies](#strategies)
  - [Managing users](#managing-users)
  - [Known Limitations](#known-limitations)
  - [Contributing](#contributing)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## What the bot is this?

This is a bot framework and a set of sample bots, referred to as "strategies" from here on (see [./lib/strategy](./lib/strategy)) for interfacing with a [provider](#provider) running on a Tradle server

The Tradle server takes care of:
- running the Tradle engine
  - secure line to your users
  - creation/monitoring of blockchain transactions
- calling your bot's web server with messages from the user (and blockchain-related events)

The Tradle app takes care of:
- cross-platform support (iOS & Android). iOS is currently more mature.
- cross-browser support (Chrome, Firefox, Safari, IE11). Chrome currently has the best support.
- UI (you can do some per-provider theming on the server-side)

This framework supports:
- asynchronous messaging
- reliable persistent-queue-based send/receive on both the server and the bot ends
- easy to get started, see below sample strategy

## Terms

Dig up your old SAT hat.

#### Provider

A provider is your bot's sock puppet. Your bot is the puppetmaster. Your bot says jump, the provider jumps. Your bot says: "tell user XYZ that s/he looks fat in that hat, and then give them a million dollars" and the provider does it without question, so be careful. But seriously, the provider can't jump, it can only send and receive messages, and transact on the blockchain.

For ease of testing and demoing, a Tradle server can run multiple service "providers". In the below Tradle app screenshot, you see two providers, Get-a-Loan and Easy Bank, which may or may not be running on one Tradle server.

![providers in Tradle app](./docs/providers.png "Providers as seen in the Tradle app")

## Usage

IMPORTANT: you will need access to the [https://hub.docker.com/r/tradle/server-cli/](https://hub.docker.com/r/tradle/server-cli/) docker image. 

Email [support@tradle.io](mailto:support@tradle.io) to request access.

These instructions have been tested on the following platforms:  
- macOS Sierra

If you run into problems setting up, submit an issue!

### Environment

Prerequisites:
- [Docker](https://docs.docker.com/engine/installation/)
- [Docker Compose](https://docs.docker.com/compose/install/)
- [Node.js](https://nodejs.org/en/) 6 or later

### Run your Tradle server

This uses [tradle-server-compose.yml](./tradle-server-compose.yml)

```sh
# enable connecting from the container to the host
# https://docs.docker.com/docker-for-mac/networking/#/known-limitations-use-cases-and-workarounds
#   see: "I want to connect from a container to a service on the host"
#   make sure your bot's web server is listening on the below IP (or on all ips: 0.0.0.0)
sudo ifconfig lo0 alias 10.200.10.1/24
docker volume create --name server-conf
docker volume create --name server-storage
# start up dockerized tradle server
docker-compose -f tradle-server-compose.yml up -d
docker attach tradle-server
# you are now in the tradle server's command line client
# let's create a provider
tradle-server$ newprovider loans "Get-a-Loan"
# Generating a really good provider: loans 
# This may take a few seconds...
# Enter a local path or a url of the provider logo:
http://www.myiconfinder.com/uploads/iconsets/128-128-767de7a98f30bb81036e1829a50cfd06-float.png
# disable the Tradle server's in-house bot, which has its own complex agenda
tradle-server$ silent loans
# subscribe your bot's web server for webhooks
# see beginning of this script for explanation for the IP address value
tradle-server$ newwebhook loans http://10.200.10.1:8000
# if you want to play with the products strategy (./lib/strategy/products.js)
# uncomment the next line:
# tradle-server$ enableproduct loans tradle.MortgageProduct
# start things up
tradle-server$ restartproviders
```

### Get started

The easiest way to get started is by playing in the Javascript console. Make sure your Tradle server us up and [running](#run-your-tradle-server). As you can see in [sample-conf.json](./sample-conf.json), the sample implementations talk a provider that listens at `http://localhost:44444/loans`, where `http://localhost:44444` is your Tradle server url, and `loans` is the handle of the provider you created in the command line client, e.g. with `newprovider loans "A Good Loan Provider name"`

[sample-conf.json](./sample-conf.json) has a sample config  
[./cmd](./cmd.js) has a simple run script that starts the web server and the console. Modify to your needs.

### Console

The console can be started by running [./cmd.js](./cmd.js). Here is a sample session in the console. Below it, see an outline of the objects available in the global scope.

#### Sample Session

```sh
$ ./cmd.js
# Listening on port 8000
# list stored users
bot.users.list()
# no users yet
{}
# list our strategies
bot.strategies.list()
# we're using the products strategy (see './lib/strategy/products.js')
[ [Function: productsStrategy] ]
# screw that for now, we want to talk to our users manually
bot.strategies.clear()
bot.strategies.list()
[]
# print to console all received message
togglePrintReceived()
# go to your Tradle app and say something to provider your bot's hooked up to
# ..yay, we got a message
#  a7d454a8ec9a1bd375f9dd16afdadff9ed8765a03016f6abf7dd10df0f7c8fbe {
#  "_s": "CkkKBHAyNTYSQQQkBY3Zz1lTCpyGK4aQzW8mzp8cz7KuvP0U9Km8vddXuL8PFnHpeFN60seFpmvGTAmy0hpA4hg/zQVsYXc2h8kIEkcwRQIgdQy4DkLs3AcYZ+LsbZvEyGNbuLzuyNHri1kWuvN3Su8CIQC6TwkhBqyJn+QG5gUFFFmnxZS+iI0OJ2yQIB4I2dGhbA==",
#  "_t": "tradle.CustomerWaiting",
#  "_z": "ac1c730a4b803b9cb9ca88c6ed0ddadce06d89e5f881f4c91f76e64050728a4c",
#  "message": "Ove has entered the chat",
#  "time": 1486070892140
}
# list stored users
bot.users.list()
# ok, this is that guy who was messaging us earlier
# { a7d454a8ec9a1bd375f9dd16afdadff9ed8765a03016f6abf7dd10df0f7c8fbe: 
#   { id: 'a7d454a8ec9a1bd375f9dd16afdadff9ed8765a03016f6abf7dd10df0f7c8fbe',
#     history: [ [Object], [Object], [Object], [Object], [Object], [Object] ],
#     forms: {},
#     applications: {},
#     products: {},
#     importedVerifications: [],
#     profile: { firstName: 'Ove' } } }
# ok, this is the guy who was messaging us earlier
# let's say hi
bot.send({ userId: 'a7d454a8ec9a1bd375f9dd16afdadff9ed8765a03016f6abf7dd10df0f7c8fbe', payload: 'hey Ove!' })
# ok, good chat, let's turn the products strategy back on
bot.strategies.use(strategies.products)
```

#### Console globals

as you can see in the session above, the console exposes a bunch of objects and functions in the global scope:

```
- bot                         [Object]
  - bot.strategies            [Object]
    - bot.strategies.list     [Function]    list enabled strategies
    - bot.strategies.use      [Function]    enable a strategy
    - bot.strategies.disable  [Function]    disable a strategy
    - bot.strategies.clear    [Function]    disable all strategies
  - bot.users                 [Object]
    - bot.users.list          [Function]    list users
    - bot.users.get           [Function]    get a user's state by id
    - bot.users.del           [Function]    delete a user
    - bot.users.clear         [Function]    delete all users
    - bot.users.new           [Function]    create a new user (you probably don't need this)
  - bot.send                  [Function]    send a message to a user
- togglePrintReceived         [Function]    toggle the printing to console of received messages
```

### Strategies

Yadda yadda, the examples were fun, now how do I build my own bot?

Implementing a basic strategy for a bot is easy. See [./lib/strategy](./lib/strategy) for examples. Here's the echo strategy, which echoes everything any given user says back to them (and boy, do users love it):

```js
// ./lib/strategy/echo.js

function echoStrategy (bot) {
  function onmessage ({ userId, payload }) {
    bot.send({ userId, payload })
  }

  bot.on('message', onmessage)

  // the strategy should return a function that disables itself
  return function disable () {
    bot.removeListener('message', onmessage)
  }
}
```

[./lib/strategy/silly.js](./lib/strategy/silly.js) is a slightly more complex strategy, and [./lib/strategy/products.js](./lib/strategy/products.js) is an expert-system type strategy that is a pared down version of the Tradle server's in-house bot's strategy.

### Managing users

`bot.users` is the user manager object, which you can explore in the [console](#console). If you like mostly empty JSON objects, you're going to love this one.

Each user has a single state object, which is accessible with `bot.users.get(userId)`

Users are automatically registered with a default state object when the first message from them is received:

```json
{
  "id": "..userId..", 
  "history": [] 
}
```

When you `bot.send(...)` or when your bot receives messages, they get appended to `state.history`. You can store whatever your evil bot needs on the user state object, just don't forget to `bot.users.save(userState)` lest the evil be thwarted.

### Known Limitations

- database: for simplicity and ease of getting started, the bot framework uses [lowdb](https://github.com/typicode/lowdb) for its databases. Yes, it's not a production-level database, it writes synchronously to the file-system, etc. Feel free to substitute it with your personal preference once you're past the prototype phase (e.g. the Tradle server uses LevelDB).

### Contributing

Pull requests are welcome. If you build a strategy that you would like to share or show off, submit a pull request to add it to this README.
