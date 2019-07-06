const tape = require('tape')
const ssbKeys = require('ssb-keys')

// create 3 servers
// give them all pub servers (on localhost)
// and get them to follow each other...

var createSsbServer =
  require('secret-stack')(require('./defaults'))
    .use(require('ssb-db'))
    .use(require('ssb-replicate'))
    .use(require('ssb-friends'))
    .use(require('ssb-legacy-conn'))
    .use(require('ssb-logging'))

const { createHash } = require('crypto')

const hash = data => createHash('sha256').update(data, 'utf8').digest()

const sign = hash('test-sign-cap1')
const shs = hash('test-shs-cap1')

const keys = {
  alice: ssbKeys.generate(),
  bob: ssbKeys.generate(),
  carol: ssbKeys.generate()
}

var dbA = createSsbServer({
  temp: 'server-alice',
  port: 45451,
  timeout: 1400,
  keys: keys.alice,
  caps: { shs, sign },
  level: 'info'
})

// uses default caps, incompatible with above
var dbB = createSsbServer({
  temp: 'server-bob',
  port: 45452,
  timeout: 1400,
  keys: keys.bob,
  seeds: [dbA.getAddress()],
  level: 'info'
})

// can connect to A
var dbC = createSsbServer({
  temp: 'server-carol',
  port: 45453,
  timeout: 1400,
  keys: keys.carol,
  caps: { shs, sign },
  level: 'info'
})

tape('signatures not accepted if made from different caps', function (t) {
  dbA.publish({ type: 'test', foo: true }, function (err, msg) {
    if (err) throw err
    console.log(msg)
    dbB.add(msg.value, function (err) {
      t.ok(err) // should not be valid in this universe
      t.ok(/invalid/.test(err.message))
      console.log(err.stack)
      t.end()
    })
  })
})

tape('cannot connect if different shs caps, custom -> default', function (t) {
  dbA.connect(dbB.getAddress(), function (err) {
    t.ok(err)
    console.log(err.stack)

    t.end()
  })
})

tape('cannot connect if different shs caps, default -> custom', function (t) {
  dbB.connect(dbA.getAddress(), function (err) {
    t.ok(err)

    console.log(err.stack)
    t.end()
  })
})

tape('cannot connect if different shs caps, default -> custom', function (t) {
  dbC.connect(dbA.getAddress(), function (err) {
    if (err) throw err
    t.end()
  })
})

tape('cleanup', function (t) {
  dbA.close()
  dbB.close()
  dbC.close()
  t.end()
})
