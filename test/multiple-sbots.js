const tape = require('tape')

tape('createSsbServer method allows creating multiple servers with the same plugins', t => {
  require('../')
    .use(require('ssb-replicate'))

  require('../')
    .use(require('ssb-replicate'))
    .use(require('ssb-legacy-conn'))

  t.pass()
  t.end()
})
