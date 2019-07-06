const fs = require('fs')
const test = require('tape')
const { exec, spawn } = require('child_process')
const crypto = require('crypto')
const net = require('net')
const mkdirp = require('mkdirp')
const { join } = require('path')
const ma = require('multiserver-address')

// travis currently does not support ipv6, becaue GCE does not.
var hasIpv6 = process.env.TRAVIS === undefined
var children = []

process.on('exit', function () {
  children.forEach(function (e) {
    e.kill('SIGKILL')
  })
})
process.on('SIGINT', function () {
  children.forEach(function (e) {
    e.kill('SIGKILL')
  })
  process.exit(1)
})

var exited = false
var count = 0
function ssbServer (t, argv, opts) {
  count++
  exited = false
  opts = opts || {}

  var sh = spawn(
    process.execPath,
    [join(__dirname, '../bin.js')]
      .concat(argv),
    Object.assign({
      env: Object.assign({}, process.env, { ssb_appname: 'test' })
    }, opts)
  )

  sh.once('exit', function (code, name) {
    exited = true
    t.equal(name, 'SIGKILL')
    if (--count) return
    t.end()
  })

  sh.stdout.pipe(process.stdout)
  sh.stderr.pipe(process.stderr)

  children.push(sh)

  return function end () {
    while (children.length) children.shift().kill('SIGKILL')
  }
}

function tryOften (times, opts, work, done) {
  if (typeof opts === 'function') {
    done = work
    work = opts
    opts = {}
  }
  const delay = 2000
  setTimeout(function () { // delay first try
    console.log('try more:', times)
    work(function (err, result) {
      if (!err) return done(null, result)
      if (opts.ignore && err.message && !err.message.match(opts.ignore)) {
        console.error('Fatal error:', err)
        return done(err)
      }
      if (!times) return done(err)
      if (exited) return done(new Error('already exited'))
      console.warn('retry run', times)
      console.error('work(err):', err)
      tryOften(times - 1, work, done)
    })
  }, delay)
}

function connect (port, host, cb) {
  var done = false
  var socket = net.connect(port, host)
  socket.on('error', function (err) {
    if (done) return
    done = true
    cb(err)
  })
  socket.on('connect', function () {
    if (done) return
    done = true
    cb(null)
  })
}

function testSsbServer (t, opts, asConfig, port, cb) {
  var dir = '/tmp/ssb-server_binjstest_' + Date.now()
  if (typeof port === 'function') { cb = port; port = opts.port }
  mkdirp.sync(dir)
  var args = [
    'start',
    '--path ' + dir
  ]

  if (asConfig) {
    fs.writeFileSync(join(dir, '.testrc'), JSON.stringify(opts))
  } else {
    ;(function toArgs (prefix, opts) {
      for (var k in opts) {
        if (opts[k] && typeof opts[k] === 'object') { toArgs(prefix + k + '.', opts[k]) } else { args.push(prefix + k + '=' + opts[k]) }
      }
    })('--', opts)
  }

  var end = ssbServer(t, args, {
    cwd: dir
  })

  tryOften(10, {
    ignore: /ECONNREFUSED/
  }, function work (cb) {
    connect(port, opts.host, cb)
  }, function (err) {
    cb(err)
    end()
  })
}

const localhosts = ['::1', '::', '127.0.0.1', 'localhost']

localhosts
  .filter(host => hasIpv6 || !host.includes(':'))
  .forEach(host => {
    const localports = [9002, 9001]
    localports.forEach(function (port) {
      ;[true, false].forEach(function (asConfig) {
        var opts = {
          host: host,
          port: 9001,
          ws: { port: 9002 }
        }
        //      if(c++) return
        test('run bin.js server with ' +
        (asConfig ? 'a config file' : 'command line options') +
        ':' + JSON.stringify(opts) + ' then connect to port:' + port
        , function (t) {
          testSsbServer(t, opts, true, function (err) {
            t.error(err, 'Successfully connect eventually')
          })
        })
      })
    })
  })

test('ssbServer should have websockets and http server by default', function (t) {
  var path = '/tmp/ssbServer_binjstest_' + Date.now()
  var caps = crypto.randomBytes(32).toString('base64')
  var end = ssbServer(t, [
    'start',
    '--host=127.0.0.1',
    '--port=9001',
    '--ws.port=9002',
    '--path', path,
    '--caps.shs', caps
  ])

  tryOften(10, function work (cb) {
    exec([
      join(__dirname, '../bin.js'),
      'getAddress',
      'device',
      '--',
      '--host=127.0.0.1',
      '--port=9001',
      '--path', path,
      '--caps.shs', caps
    ].join(' '), {
      env: Object.assign({}, process.env, { ssb_appname: 'test' })
    }, function (err, stdout, sderr) {
      if (err) return cb(err)
      cb(null, JSON.parse(stdout)) // remove quotes
    })
  }, function (err, addr) {
    t.error(err, 'ssbServer getAdress succeeds eventually')
    if (err) return end()
    t.ok(addr, 'address is not null')
    t.comment('result of ssb-server getAddress: ' + addr)

    var remotes = ma.decode(addr)
    console.log('remotes', remotes, addr)
    const wsRemotes = remotes.filter(function (a) {
      return a.find(function (component) {
        return component.name === 'ws'
      })
    })
    t.equal(wsRemotes.length, 1, 'has one ws remote')
    var remote = ma.encode([wsRemotes[0]])
    // this breaks if multiserver address encoding changes
    t.ok(remote.indexOf('9002') > 0, 'ws address contains expected port')

    // this is a bit annoying. we can't signal ssb-client to load the secret from .path
    // it either has to be the first argument, already loaded
    var key = require('ssb-keys').loadOrCreateSync(join(path, 'secret'))
    require('ssb-client')(key, {
      path: path,
      caps: { shs: caps }, // has to be set when setting any config
      remote: remote
    }, function (err, ssb) {
      t.error(err, 'ssb-client returns no error')
      t.ok(ssb.manifest, 'got manifest from api')
      t.ok(ssb.version, 'got version from api')
      ssb.whoami(function (err, feed) {
        t.error(err, 'ssb.whoami succeeds')
        t.equal(feed.id[0], '@', 'feed.id has @ sigil')
        end()
      })
    })
  })
})

test('ssb-server client should work without options', function (t) {
  var path = '/tmp/ssb-server_binjstest_' + Date.now()
  mkdirp.sync(path)
  fs.writeFileSync(path + '/config',
    JSON.stringify({
      port: 43293, ws: { port: 43294 }
    })
  )
  var caps = crypto.randomBytes(32).toString('base64')
  var end = ssbServer(t, [
    'start',
    '--path', path,
    '--config', path + '/config',
    '--caps.shs', caps
  ])

  tryOften(10, function work (cb) {
    exec([
      join(__dirname, '../bin.js'),
      'getAddress',
      'device',
      '--path', path,
      '--config', path + '/config',
      '--caps.shs', caps
    ].join(' '), {
      env: Object.assign({}, process.env, { ssb_appname: 'test' })
    }, function (err, stdout, sderr) {
      if (err) return cb(err)
      cb(null, JSON.parse(stdout)) // remove quotes
    })
  }, function (err, addr) {
    t.error(err, 'ssb-server getAddress succeeds eventually')
    if (err) return end()
    t.ok(addr)

    t.comment('result of ssb-server getAddress: ' + addr)
    end()
  })
})
