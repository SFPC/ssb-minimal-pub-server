const tape = require('tape')

tape('createSsbServer method allows creating multiple servers with the same plugins', t => {
  const { createSsbServer } = require('../')

  createSsbServer()
    .use(require('ssb-replicate'))

  createSsbServer()
    .use(require('ssb-replicate'))
    .use(require('ssb-legacy-conn'))

  t.pass()
  t.end()
})
