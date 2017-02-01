const repl = require('repl')
const installHistory = require('./repl-history')
const { isPromise } = require('./utils')
let server

/**
 * REPL singleton
 * @param  {String} options.prompt
 * @param  {bot}    options.bot
 * @return {REPLServer}
 */
module.exports = function createReplServer ({ prompt, bot }) {
  if (server) return server

  server = promisify(repl.start({
    prompt,
    ignoreUndefined: true
  }))

  installHistory({ server, prompt })
  const context = server.context

  for (var p in bot) {
    if (typeof bot[p] === 'function') {
      context[p] = bot[p].bind(bot)
    } else {
      context[p] = bot[p]
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

  function print (obj) {
    console.log(JSON.stringify(obj, null, 2))
    server.displayPrompt()
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

  server.eval = function coEval(cmd, context, filename, callback) {
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
