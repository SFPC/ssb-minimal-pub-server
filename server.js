const fs = require('fs')
const ProgressBar = require('./lib/progress')

const runServer = (config, manifestFile) => {
  const packageJson = require('./package.json')

  console.log(`running server`)
  console.log(packageJson.name, packageJson.version, config.path, 'logging.level:' + config.logging.level)
  console.log(`my key ID: ${config.keys.public}`)

  const createSsbServer = require('./')
    .use(require('ssb-onion'))
    .use(require('ssb-unix-socket'))
    .use(require('ssb-no-auth'))
    .use(require('ssb-plugins'))
    .use(require('ssb-master'))
    .use(require('ssb-legacy-conn'))
    .use(require('ssb-replicate'))
    .use(require('ssb-friends'))
    .use(require('ssb-blobs'))
    .use(require('ssb-invite'))
    .use(require('ssb-local'))
    .use(require('ssb-logging'))
    .use(require('ssb-query'))
    .use(require('ssb-links'))
    .use(require('ssb-ws'))
    .use(require('ssb-ebt'))
    .use(require('ssb-ooo'))
  // add third-party plugins

  require('ssb-plugins').loadUserPlugins(createSsbServer, config)

  const server = createSsbServer(config)

  // write RPC manifest to ~/.${ssb_appname}/manifest.json
  fs.writeFileSync(manifestFile, JSON.stringify(server.getManifest(), null, 2))

  if (process.stdout.isTTY && (config.logging.level !== 'info')) { ProgressBar(server.progress) }
}

modules.exports = runServer