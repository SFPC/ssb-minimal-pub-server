const SecretStack = require('secret-stack')

const SSB = require('ssb-db')
const caps = require('ssb-caps')

// create a sbot with default caps. these can be overridden again when you call create.
const createSsbServer = () => SecretStack({ caps: { shs: Buffer.from(caps.shs, 'base64') } }).use(SSB)

module.exports = createSsbServer()
