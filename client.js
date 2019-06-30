var pull = require('pull-stream')
var toPull = require('stream-to-pull-stream')
var File = require('pull-file')
var Client = require('ssb-client')
var createHash = require('multiblob/util').createHash

var muxrpcli = require('muxrpcli')
var cmdAliases = require('./lib/cli-cmd-aliases')
const { argv, exit, stdin } = process

const runClient = (config, manifest, argOptions, cb) => {
  const options = {
    manifest: manifest,
    port: config.port,
    host: config.host || 'localhost',
    caps: config.caps,
    key: config.key || config.keys.id
  }

    Client(config.keys, options, (error, rpc) => {
      if (error) {
        if (cb) return cb(error)
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
      if (argv[2] === 'blobs.add') {
        const filename = argv[3]
        const source =
        filename ? File(filename)
          : !stdin.isTTY ? toPull.source(stdin)
            : (function () {
              console.error('USAGE:')
              console.error('  blobs.add <filename> # add a file')
              console.error('  source | blobs.add   # read from stdin')
              exit(1)
            })()
        const hasher = createHash('sha256')
        pull(
          source,
          hasher,
          rpc.blobs.add(err => {
            if (err) { throw err }
            console.log('&' + hasher.digest)
            exit()
          })
        )
        return
      }

      // run commandline flow
      muxrpcli(argOptions, manifest, rpc, config.verbose)
    })
  }
module.exports = runClient
