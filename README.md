# @tradle/bots

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->


- [What the bot is this?](#what-the-bot-is-this)
- [Your bot, the Tradle server, and the clients](#your-bot-the-tradle-server-and-the-clients)
- [Prerequisites](#prerequisites)
  - [Platform](#platform)
  - [Environment](#environment)
    - [OSX Users](#osx-users)
  - [Run docker, login](#run-docker-login)
- [Usage](#usage)
  - [Clone this repository](#clone-this-repository)
  - [Install dependencies](#install-dependencies)
    - [with npm](#with-npm)
    - [with yarn](#with-yarn)
  - [Run Tradle server](#run-tradle-server)
  - [Create a provider](#create-a-provider)
  - [Connect your Tradle app](#connect-your-tradle-app)
    - [Web](#web)
    - [Mobile](#mobile)
    - [Common](#common)
  - [Configuring your bot](#configuring-your-bot)
  - [Console](#console)
    - [Sample Session](#sample-session)
    - [Console globals](#console-globals)
  - [Strategies](#strategies)
    - [Receiving messages](#receiving-messages)
    - [Sending messages](#sending-messages)
    - [Creating blockchain seals](#creating-blockchain-seals)
    - [Events](#events)
  - [Managing users](#managing-users)
- [Known Limitations](#known-limitations)
- [Contributing](#contributing)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## What the bot is this?
[Apps are dying, long live the bots](http://www.wired.co.uk/article/here-come-the-bots). 
Bots provide a universal conversational UI, where new type of apps (called bots) are built on the server side, like we used to do with the Web apps.
Tradle's blockchain-based bot framework provides the Tradle app on iOS, Android and Web, so that you can build apps / bots really really fast. Why another bot framework? Why blockchain? 

Tradle offers forms, not just texting. Forms are powerful, in 1995 they made the browser a universal interface for building apps. Devs define new forms with data models in json format. More on that later. 

Tradle server seals the data exchanged via the forms onto the blockchain. This way any agreement, order, or other commercial or governmental transaction can be proven to have taken place. This allows to build powerful applications that work across many web sites. It allows to decentralize identities, marketplaces, governments, most everything, including the app stores, controlled today by two powerful corporations. Blockchain was called by the Economist, [the Trust Machine](http://www.economist.com/news/leaders/21677198-technology-behind-bitcoin-could-transform-how-economy-works-trust-machine). The Economist said that the blockchain will redefine how economy works, defy corruption, fight monopolies, and help us build a better world. No wonder over [billion dollars has been invested into blockchain startups](https://news.bitcoin.com/1-4-billion-invested-blockchain-pwc/).

The tectonic shift has started. It is up to you to make a difference. And Tradle is here to help.

Tradle has used the blockchain, forms and the bot interface to build a powerful global identity system, and is now selling its variant called KYC (know your customer) to 40 of the biggest financial institutions in the world. A startup like yours, we graduated from Startupbootcamp Fintech program in London at the end of 2015, and have won many awards since then. With Tier 1 multinationals buying it, [regulators supporting it](https://www.fca.org.uk/news/press-releases/financial-conduct-authority-unveils-successful-sandbox-firms-second-anniversary), we finally can open this as a framework for you.

User in Tradle app opens a conversation with the [provider](#your-bot-the-tradle-server-and-the-clients). The brains behind the provider is your bot.

The Tradle server takes care of:
  - secure line to your users
  - creation/monitoring of blockchain transactions
- calling your bot's web server with messages from the user (and blockchain-related events)

The Tradle app takes care of:
- cross-platform support (iOS & Android). iOS is currently more mature.
- cross-browser support (Chrome, Firefox, Safari, IE11). Chrome currently has the best support.
- offline support, a must on mobiles, but very hard to develop. You have it here out of the box.
- UI. You can customize it with per-provider styles on the server-side. In the near future you will be able to add your own JS code that will be executed in the app.

This framework supports:
- asynchronous messaging
- reliable persistent-queue-based send/receive on both the server and the bot ends (the basis for offline support)
- easy to get started. We provide set of sample bots, which we call "strategies"

## Your bot, the Tradle server, and the clients

![communication diagram](./docs/diagram.png "communication diagram: bots, Tradle server, clients")

The Tradle server acts like a router between your bot and your clients, on their Tradle apps. Your bot will represent a single provider, as different providers typically require different functionality. Being able to set up multiple service providers on one Tradle server makes it easier to test and do demos.

From the client's perspective (see the Tradle app screenshot below), providers are listed together in the Conversations screen.

In the guide that follows, you'll set up a service provider called Silly, and connect your bot to it.

![providers in Tradle app](./docs/providers1.png "Providers as seen in the Tradle app")

## Prerequisites

How can you have any pudding if you don't eat your prerequisites?

### Platform

These instructions have been tested on the following platforms:
- macOS Sierra
- Windows 10 Home Edition

If you run into problems setting up, submit an issue!

### Environment

You will be using a dockerized Tradle server, and building your bots with Node.js

- [Docker](https://docs.docker.com/engine/installation/). 
On Windows 10 Home Edition you will need to install Docker Toolbox instead of Docker. 
Follow the Docker link, find Windows installation page and search for Toolbox.
- [Docker Compose](https://docs.docker.com/compose/install/)
- [Node.js](https://nodejs.org/en/) 6 or later

#### OSX Users

1. Docker used to run via boot2docker, but now has the much better [Docker for Mac](https://docs.docker.com/docker-for-mac/). Install it. 
2. Remove environment variables in your `~/.bash_profile` that start with `DOCKER_`. These are boot2docker's legacy.
3. Open a fresh shell. Mm, you smell that? Me neither. boot2docker will plague us no more.

### Run docker, login

1. Create an account on Docker Hub if you haven't already
2. Make sure Docker is running. To make sure you made sure, run `docker info` and count off two microseconds. If it doesn't spit out some awesome stats, docker is probably not running.
3. Run `docker login` in your shell, and login with your Docker Hub credentials

## Usage

### Clone this repository

```sh
git clone https://github.com/tradle/bots tradle-bots
cd tradle-bots
```

### Install dependencies

This project uses [yarn](https://github.com/yarnpkg/yarn) package manager, which is like [npm](https://github.com/npm/npm), but faster, leaner, and more emoji-infused. You had as at "emoji", yarn!

To install it, smirk ironically, and run: 

```sh
npm i -g yarn
# if that doesn't work: sudo npm i -g yarn
```

Then install dependencies:

```sh
yarn
```

### Run Tradle server

This uses the Docker Compose file [tradle-server-compose.yml](./tradle-server-compose.yml), at the root of your `tradle-bots` folder:

On OSX, to enable connecting from the container to the host, run:

```sh
# https://docs.docker.com/docker-for-mac/networking/#/known-limitations-use-cases-and-workarounds
#   see: "I want to connect from a container to a service on the host"
sudo ifconfig lo0 alias 10.200.10.1/24
# on Windows we do not know yet how to achieve the same, so instead of connecting to Tradle server using localhost, you will need to use the IP address printed in console by docker. On our machine it was 192.168.99.100
```

Start the server!

```sh
# switch to your tradle-bots directory
# start up dockerized tradle server and web app
yarn run server
# check things are running:
docker ps
# ... NAMES
# ... tradle-web-app
# ... tradle-server
```

### Create a provider

Let's create a provider called Silly, with handle `silly` (url path: `/silly`)

```sh
# attach to the tradle-server container
# or: `yarn run attach`
docker attach tradle-server
# ( you may need to hit Enter an extra time to show the prompt )
# you are now in the tradle server's command line client
# let's create a provider
tradle-server$ newprovider silly Silly
# Generating a really good provider: silly 
# This may take a few seconds...
# Enter a local path or a url of the provider logo:
https://afv.com/wp-content/uploads/2014/11/Tongue.png
# subscribe your bot's web server for webhooks
# OSX: see the previous section for the explanation for the IP address value
tradle-server$ newwebhook silly http://10.200.10.1:8000
# start things up
tradle-server$ restartproviders
```

Your Tradle server is now running at `http://localhost:44444`, and `silly` provider is running at `http://localhost:44444/silly`

*Note: when attached to a Docker container, if you hit Ctrl+C, you will kill it. Docker Compose will automatically restart it (see the `restart: always` flag in [tradle-server-compose.yml](./tradle-server-compose.yml)), but to be nice, detach with `Ctrl+P Ctrl+Q`*

### Connect your Tradle app

#### Web

1. Make sure `docker ps` shows `tradle-web-app` running
2. Open `http://localhost:55555` in the browser

#### Mobile

1. Make sure your phone is on the same network as the computer running your Tradle server.
2. Get your computer's local ip.
3. In your Tradle app, on the Conversations screen, click the red button, and choose Add Server URL. Enter the address of your Tradle server: `http://{your_local_ip}:44444`

### Configuring your bot

No `silly` provider is complete without a silly strategy. Below is the annotated default config file, which can be found at [./sample-conf.json](./sample-conf.json). It runs the strategy in [./lib/strategy/silly.js](./lib/strategy/silly.js). Once you outgrow the `silly` strategy (it took me years), and you've sampled the others in [./lib/strategy](./lib/strategy), feel free to create your own. To use a particular config file, run `yarn start` as follows:

```sh
# nerds:
#   the extra '--' after yarn start is to help yarn distinguish its own arguments
#   from arguments to the underlying script (./cmd.js)
#   it is equivalent to: DEBUG=tradle:* ./cmd.js --conf ./path/to/your/config.json
yarn start -- --conf ./path/to/your/config.json
```

```js
{
  // the port on which your bot will run its web server
  // when you register your webhooks on the Tradle server, specify this port
  "port": 8000,
  // the console prompt, in this case a red hot chili pepper icon
  "repl": "\uD83C\uDF36  ",
  // the url of the provider your bot controls on the Tradle server
  // url format: http://localhost:44444/{providerHandle}
  "providerURL": "http://localhost:44444/silly",
  // the directory in which your bot will store its databases
  // and any temporary files
  "dir": "./storage/silly",
  // strategies your bot will use when it starts
  "strategies": [
    "./lib/strategy/silly.js"
  ]
}
```

*Note: If running multiple bots simultaneously, be sure to use a different `port` and a different `dir` for each.*

### Console

The easiest way to get started is by playing in the Javascript console. Make sure your Tradle server us up and [running](#run-tradle-server). 

The console can be started by running `yarn start`. Below is a sample session. Below that, see an outline of the objects and functions available in the global scope.

#### Sample Session

```sh
# switch to your tradle-bots directory
#
# yarn start runs ./cmd.js with lots of logging. See "scripts" in package.json
$ yarn start -- --conf ./conf/silly.json
# Listening on port 8000
# 
# before anything test the connection to your provider:
health()
testing connection to provider...
all good!
# list stored users
bot.users.list()
# no users yet
{}
# list our strategies
bot.strategies.list()
# we're using the silly strategy (see './lib/strategy/silly.js')
# depending on your config (sample-conf.json), you may be using a different one
[ [Function: sillyStrategy] ]
# screw that for now, we want to talk to our users manually
bot.strategies.clear()
bot.strategies.list()
[]
# print to console all received message
togglePrintReceived()
# go to your Tradle app and say something to the provider your bot's hooked up to
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
# ok, this is that person that was messaging us earlier
# { a7d454a8ec9a1bd375f9dd16afdadff9ed8765a03016f6abf7dd10df0f7c8fbe: 
#   { id: 'a7d454a8ec9a1bd375f9dd16afdadff9ed8765a03016f6abf7dd10df0f7c8fbe',
#     history: [ [Object], [Object], [Object], [Object], [Object], [Object] ],
#     profile: { firstName: 'Ove' } } }
# ok, this is the guy who was messaging us earlier
# let's say hi (make sure to replace a7d4... with the 'id' that bot.users.list() printed out)
bot.send({ userId: 'a7d454a8ec9a1bd375f9dd16afdadff9ed8765a03016f6abf7dd10df0f7c8fbe', object: 'hey Ove!' })
# ok, good chat, let's turn the Silly strategy back on. 
# Silly will send a message to the app, and you can chat with Silly, 
# but do not expect any serious stuff, be silly yourself
bot.strategies.use(strategies.silly)
# if you build your own strategy, you simply use require(..):
#   bot.strategies.use(require('./path/to/my/strategy'))
# or add the path to your own conf file's "strategies" field
```

#### Console globals

as you can see in the session above, the console exposes a bunch of objects and functions in the global scope:

```
- health                      [Function]    test the connection to your provider
- togglePrintReceived         [Function]    toggle the printing to console of received messages
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
  - bot.seals                 [Object]
    - bot.seals.list          [Function]    list seals
    - bot.seals.get           [Function]    get a seal by an object link
    - bot.seals.queued        [Function]    get queued seals
  - bot.queued                [Object]
    - bot.queued.seals        [Function]    list queued seals (same as bot.seals.queued())
    - bot.queued.send         [Function]    list queued sends
    - bot.queued.receive      [Function]    list queued receives
  - bot.send                  [Function]    send a message to a user
```

### Strategies

Yadda yadda, the examples were fun, now how do I build my own bot?

Implementing a basic strategy for a bot is easy. See [./lib/strategy](./lib/strategy) for examples. Below is the echo strategy, which echoes everything any given user says back to them (and boy, do users love it).

```js
// ./lib/strategy/echo.js
const { co } = require('bluebird').coroutine

module.exports = function echoStrategy (bot) {
  return bot.addReceiveHandler(co(function* ({ user, object, link /*, other goodies*/ }) {
    // we received `object`
    // send it back
    yield bot.send({ userId: user.id, object })
  }))
}
```

If your Promises are a bit rusty, or if you're asking yourself "what's `co`?" or "isn't `yield` only for generators?", skim [this](./docs/promises.md)

[./lib/strategy/silly.js](./lib/strategy/silly.js) is a slightly more complex strategy, and [./lib/strategy/products.js](./lib/strategy/products.js) is an expert-system type strategy that is a pared down version of the Tradle server's in-house bot's strategy.

#### Receiving messages

To handle incoming messages from users, add a receive handler as follows:

```js
function myStrategy (bot) {
  bot.addReceiveHandler(function ({ user, object, link /*, other goodies*/ }) {
    // return a Promise to ensure receive order
  })

  // tip: wrap in `co` to make your async javascript saner:
  // 
  // const co = require('bluebird').coroutine
  // bot.addReceiveHandler(co(function* ({ user, object /*, other goodies*/ }) {
  //   yield promiseSomething()
  //   yield promiseSomethingElse()
  // }))
}
```

#### Sending messages

To send a message to a user, use `bot.send({ userId, object })`:

```js

function myStrategy (bot) {
  // const news = ...
  // ...
  news.on('raining men', function () {
    // bot.send(...) returns a Promise. Sensing a theme?
    bot.send({ 
      userId: String, 
      object: {
        _t: 'tradle.SimpleMessage'
        message: 'wear a helmet'
      }
      // equivalent shorthand for sending simple messages:
      // object: 'wear a helmet'
    })
  })
  // ...
}
```

#### Creating blockchain seals

Objects sent to a user, or received from a user can be sealed on blockchain as follows. To seal an object, you need to know its `link`, which 

```js
function echoAndSealStrategy (bot) {
  return bot.addReceiveHandler(co(function* ({ user, object, link /*, other goodies*/ }) {
    yield bot.send({ userId: user.id, object })
    yield bot.seal({ link })
  }))
}
```

#### Events

the `bot.users` object emits the following events:

- 'create': a new user state object has been created
- 'delete': a user state object has been deleted
- 'clear': all user state has been deleted
- 'update': a user state object has changed

the `bot.seals` object emits the following events:

- 'push': a request to seal an object has been pushed to the Tradle server
- 'wrote': the Tradle server has written a seal to the blockchain
- 'read': the Tradle server has read a seal for an object from the blockchain

the `bot` object emits the following events:

- 'message': when a message has been handled by all enabled strategies without error
- 'sent': when a message has been sent to the Tradle server for deliver to the client
- 'seal:push', 'seal:wrote', 'seal:read': re-emitted for convenience from `bot.seals`
- 'user:create', 'user:delete', 'user:clear', 'user:update': re-emitted for convenience from `bot.users`

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

## Known Limitations

- database: for simplicity and ease of getting started, the bot framework uses [lowdb](https://github.com/typicode/lowdb) for its databases. Yes, it's not a production-level database, it writes synchronously to the file-system, etc. Feel free to substitute it with your personal preference once you're past the prototype phase (e.g. the Tradle server uses LevelDB).

## Contributing

Pull requests are welcome. If you build a strategy that you would like to share or show off, submit a pull request to add it to this README.
