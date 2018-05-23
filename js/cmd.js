#!/usr/bin/env node

const AWS = require('aws-sdk')
const createCredstash = require('./')
const defaults = require('./defaults')

const toContext = args => {
  const context = {}
  args.forEach(arg => {
    const [k, v] = arg.split('=')
    context[k] = v
  })

  return context
}

const args = require('minimist')(process.argv.slice(2), {
  alias: {
    p: 'profile',
    r: 'region',
    t: 'table',
    b: 'bucket',
    k: 'key',
    a: 'algorithm',
    v: 'version',
    e: 'encoding',
  },
  default: {
    algorithm: defaults.DEFAULT_ALGORITHM,
    digest: defaults.DEFAULT_DIGEST,
    key: defaults.DEFAULT_KMS_KEY,
  }
})

const {
  // aws
  profile,
  region,

  // store
  table,
  bucket,
  folder,

  // operation
  key,
  version,
  algorithm,
  digest,
  encoding,
} = args

const awsClientOpts = {}

if (profile) {
  AWS.config.credentials = new AWS.SharedIniFileCredentials({ profile })
}

if (region) {
  awsClientOpts.region = region
  AWS.config.update({ region })
}

const [method, ...opArgs] = args._
const opts = { version }

switch (method) {
  case 'put':
    opts.name = opArgs.shift()
    opts.secret = Buffer.from(opArgs.shift())
    opts.digest = digest
    opts.context = toContext(opArgs)
    break
  case 'get':
    opts.name = opArgs.shift()
    opts.context = toContext(opArgs)
    break
  case 'list':
    if (opArgs.length && !opArgs[0].includes('=')) {
      opts.name = opArgs.shift()
    }

    break
  default:
    break
}

let store
if (bucket) {
  store = createCredstash.store.s3({
    client: new AWS.S3(awsClientOpts),
    bucket,
    folder
  })
}

const credstash = createCredstash({
  table,
  store,
  kmsKey: key,
  algorithm,
})

const postProcess = result => {
  if (method === 'get' && encoding) {
    return result.toString(encoding)
  }

  return result
}

credstash[method](opts)
  .then(
    postProcess,
    err => console.error(err.stack)
  )
  .then(result => {
    if (typeof result !== 'undefined') console.log(result)
  })
