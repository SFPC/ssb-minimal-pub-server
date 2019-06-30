#! /usr/bin/env node
var fs = require('fs')
var path = require('path')
var pull = require('pull-stream')
var toPull = require('stream-to-pull-stream')
var File = require('pull-file')
var explain = require('explain-error')
var Config = require('ssb-config/inject')
var Client = require('ssb-client')
var createHash = require('multiblob/util').createHash
var minimist = require('minimist')
var muxrpcli = require('muxrpcli')
var cmdAliases = require('./lib/cli-cmd-aliases')
const runServer = require('./server')

// command [options] -- [config]
let options = argv.slice(2)
const config = args.splice(options.indexOf('--'))

if (options[0].includes('help')) {
  const invocation = argv.slice(0,2).join(' ')
  console.log(`
  ssb-local - run a scuttlebutt local node

  ssb-local will start a local server and save its config in \`manifest.json\`

  open another terminal, and then you can connect with the correct config options

  the most important settings are \`ssb_appname\` and \`--host\`:
    ssb_appname=[appname]
      environment variable, what directory to sync in ~/ (~/.ssb, ~/.{ssb_appname})

    --host [host] the address to listen on / connect to

  ssb_appname="[appname]" ${invocation} [command] [command options] -- [config]

  example:

  # start the server
  ssb_appname="test" ${invocation} -- --host=127.0.0.1

  # publish a message

  ssb_appname="test" ${invocation} publish --type=post --text="hi there" -- --host=127.0.0.1
  `)
}

if (!process.env.ssb_appname) {
  throw explain(new Error(`missing ssb_appname`), `
    Please specify ssb_appname in your environment.
    This will also be the name for a hidden folder in your home directory.
    eg: $ ssb_appname=foo ssb-local # creates ~/.foo
`)
}

const config = Config(process.env.ssb_appname, minimist(conf))

const manifestFile = path.join(config.path, 'manifest.json')

let manifest
try {
  const data = fs.readFileSync(manifestFile)
  manifest = JSON.parse(data)
} catch (err) {
  // If we have trouble reading or parsing the config, start a new server
  return runServer(config)
}

const options = {
  manifest: manifest,
  port: config.port,
  host: config.host || 'localhost',
  caps: config.caps,
  key: config.key || config.keys.id
}

Client(config.keys, options, (error, rpc) => {
  if (error) {
    if (error.message.includes('could not connect')) {
      explain(error, `Error: Could not connect to ssb-server ${options.host}:${options.port}`)
      process.exit(1)
    }
    throw error
  }

  // add aliases
  for (let alias in cmdAliases) {
    rpc[alias] = rpc[cmdAliases[alias]]
    manifest[alias] = manifest[cmdAliases[alias]]
  }

  // add 'sync' command to write out manifest
  manifest.config = 'sync'
  rpc.config = cb => {
    console.log(JSON.stringify(config, null, 2))
    cb()
  }

  // HACK
  // we need to output the hash of blobs that are added via blobs.add
  // because muxrpc doesnt support the `sink` callback yet, we need this manual override
  // -prf
  if (process.argv[2] === 'blobs.add') {
    const filename = process.argv[3]
    const source =
      filename ? File(filename)
        : !process.stdin.isTTY ? toPull.source(process.stdin)
          : (function () {
            console.error('USAGE:')
            console.error('  blobs.add <filename> # add a file')
            console.error('  source | blobs.add   # read from stdin')
            process.exit(1)
          })()
    const hasher = createHash('sha256')
    pull(
      source,
      hasher,
      rpc.blobs.add(err => {
        if (err) { throw err }
        console.log('&' + hasher.digest)
        process.exit()
      })
    )
    return
  }

  // run commandline flow
  muxrpcli(argv, manifest, rpc, config.verbose)
})
