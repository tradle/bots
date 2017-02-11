const fs = require('fs')
const path = require('path')
const repl = require('repl')
// const strategies = require('./strategy')
const installHistory = require('./repl-history')
const { isPromise, co } = require('./utils')
// only one allowed
let server

/**
 * REPL singleton
 * @param  {String} options.prompt
 * @param  {bot}    options.bot
 * @return {REPLServer}
 */
module.exports = function createReplServer ({ prompt, app }) {
  if (server) return server

  const { bot } = app
  server = promisify(repl.start({
    prompt,
    ignoreUndefined: true
  }))

  installHistory({ server, prompt })
  const context = server.context
  context.bot = {}

  for (let p in bot) {
    if (typeof bot[p] === 'function') {
      if (p !== 'receive') {
        context.bot[p] = bot[p].bind(bot)
      }
    } else {
      context.bot[p] = bot[p]
    }
  }

  let printing
  context.togglePrintReceived = function togglePrintReceived (event='message') {
    if (printing) {
      bot.removeListener(event, print)
    } else {
      bot.on(event, print)
    }

    printing = !printing
  }

  context.help = help
  context.strategies = {
    echo: require('./strategy/echo'),
    silly: require('./strategy/silly')
  }

  Object.defineProperty(context.strategies, 'products', {
    get: function () {
      return require('./strategy/products')
    }
  })

  context.health = co(function* () {
    /* eslint no-console: "off" */
    console.log('testing connection to provider...')
    try {
      yield app.health()
      console.log('roundtrip health check passed!')
    } catch (err) {
      console.error(err)
    }
  })

  function print ({ user, object }) {
    console.log(user.id, JSON.stringify(object, null, 2))
    server.displayPrompt()
  }

  function help () {
    const helpPath = path.resolve(__dirname, '../docs/repl-help.txt')
    fs.createReadStream(helpPath)
      .on('end', server.displayPrompt.bind(server))
      .pipe(process.stdout)
  }

  return server

  // const initScript = process.argv[2]
  // if (initScript) {
  //   const scriptBody = fs.readFileSync(path.resolve(initScript), { encoding: 'utf8' })
  //   vm.createContext(context)
  //   vm.runInContext(scriptBody, context)
  //   server.displayPrompt()
  // }
}

// source: https://github.com/mvertes/co-shell
// (with minor adaptations)
function promisify (server) {
  const originalEval = server.eval

  server.eval = function (cmd, context, filename, callback) {
    if (cmd.match(/\W*yield\s+/)) {
      cmd = 'co(function* () {' + cmd.replace(/^\s*var\s+/, '') + '})'
    }

    originalEval.call(server, cmd, context, filename, function (err, res) {
      if (err || !isPromise(res)) {
        return callback(err, res)
      }

      res.then(
        result => callback(null, result),
        callback
      )
    })
  }

  return server
}
