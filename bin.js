#! /usr/bin/env node
var fs = require('fs')
var path = require('path')
var explain = require('explain-error')
var Config = require('ssb-config/inject')
var minimist = require('minimist')
const { argv, env, exit } = process
const waitOn = require('wait-on')

const runServer = require('./server.js')
const runClient = require('./client.js')

// command [options] -- [config]
const argOptions = argv.slice(2)
const argConfig = argv.includes('--') ? argv.slice(argv.indexOf('--')) : []

if (!argOptions.length || argOptions[0].includes('help')) {
  const invocation = [process.argv0, process.argv[1].replace(process.cwd() + '/', '')].join(' ')
  console.log(`
  # ${invocation}
  run and talk to a scuttlebutt local node

  ssb_appname="<appname>" ${invocation} [command] [command options] -- [config] --host=<host>

  The default command is \`help\`, which shows this help
  
  The default host is \`::1\` or \`127.0.0.1\`, which is your localhost

  You must choose an appname - this is where all data will be placed (in ~/.<appname>).
  If you are already running some other server (like patchwork), use \`ssb\` to interact with the main database/network.

  example:

  # start the server
  ssb_appname="test" ${invocation} start -- --host=$(hostname |awk '{print $1}')

  # publish a message

  ssb_appname="test" ${invocation} publish --type=post --text="hi there" -- --host=$(hostname |awk '{print $1}')
  `)
  exit(1)
}

if (!env.ssb_appname) {
  throw explain(new Error(`missing ssb_appname`), `
    Please specify ssb_appname in your environment.
    This will also be the name for a hidden folder in your home directory.
    eg: $ ssb_appname=foo ssb-local # creates ~/.foo
`)
}

const config = Config(env.ssb_appname, minimist(argConfig))
const manifestFile = path.join(config.path, 'manifest.json')

if (argOptions.includes('start')) {
  runServer(config, manifestFile)
} else {
  fs.readFile(manifestFile, async (error, data) => {
    // If there is no manifest file, create one and run the command
    if (error && error.code === 'ENOENT') {
      explain(error, `Error: Could not read manifest ${manifestFile}, attempting to create one`)
      setTimeout(() => runServer(config, manifestFile), 0)
      await waitOn({ resources: [`file://${manifestFile}`] })
      data = fs.readFileSync(manifestFile)
    }
    const manifest = JSON.parse(data)

    runClient(config, manifest, argOptions, (error) => {
      if (error) {
        // If we cannot connect, then start the server
        if (error.message.includes('could not connect')) {
          explain(error, `Error: Could not connect to ssb-server ${config.host}:${config.port}, attempting to create one`)
          runServer(config, manifestFile, () => {
            runClient(config, manifest, argOptions)
          })
        }
      }
    })
  })
}