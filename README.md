# ssb-local-pub-server

This is a friendly fork of [ssb-minimal-pub-server][] aimed at a minimal core useful for a local pub.
We forked to experiment before upstreaming the more useful contributions.

## What is a local pub?

A local pub is a node meant to serve a tight knit community.
Please see [the changelog](changelog.md) for more specific features.

## Goals & non-goals

First and foremost this is meant to serve the [sfpc][] community.

Upon installation it is recommended that you supply a [device address][],
which enables nodes to use your pub for peer-invites.

## Run

    npx @sfpc/local-pub

[device address]: https://github.com/ssbc/ssb-device-address#usage
[ssb-minimal-pub-server]: https://github.com/ssbc/ssb-minimal-pub-server
[sfpc]: https://sfpc.io
