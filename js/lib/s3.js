
const flattenDeep = require('lodash/flattenDeep')
const utils = require('./utils')
const schema = require('./schema')

const getDigest = digest => {
  const normalized = digest.toLowerCase()
  if (!(normalized in schema.Digest)) {
    throw new Error(`unknown digest: ${digest}`)
  }

  return schema.Digest[normalized]
}

const unserialize = buf => {
  const raw = schema.Secret.decode(buf)
  raw.digest = utils.keyByValue(schema.Digest, raw.digest)
  return raw
}

const serialize = item => {
  const { name, version, key, contents, hmac, digest } = item
  return schema.Secret.encode({
    name,
    version: String(version),
    key,
    contents,
    hmac,
    digest: getDigest(digest),
  })
}

const pageVersions = async ({ client, bucket }, opts={}) => {
  const { key, limit } = opts
  const Bucket = bucket
  const listParams = {
    Bucket,
    Prefix: key,
  }

  if (limit) listParams.MaxKeys = limit

  const getByVersion = async ({ VersionId }) => {
    const result = await client.getObject({ Bucket, Key: key, VersionId }).promise()
    return unserialize(result.Body)
  }

  const promiseContents = []

  let result
  let promiseVersions
  do {
    result = await client.listObjectVersions(listParams).promise()
    promiseVersions = Promise.all(result.Versions.filter(v => v.Key === key).map(getByVersion))
    promiseContents.push(promiseVersions)
    if (result.NextKeyMarker && result.NextKeyMarker !== key) {
      break
    }

    listParams.VersionIdMarker = result.NextVersionIdMarker
  } while (result.IsTruncated)

  const batches = await Promise.all(promiseContents)
  return flattenDeep(batches)
}

const pageResults = async (s3, opts={}) => {
  const { client, bucket } = s3
  const { prefix, limit=0 } = opts
  const Bucket = bucket
  const listParams = { Bucket }

  if (prefix) listParams.Prefix = prefix
  if (limit) listParams.MaxKeys = limit

  const promiseContents = []
  let result
  let promiseVersions
  do {
    result = await client.listObjectsV2(listParams).promise()
    promiseVersions = Promise.all(result.Contents.map(({ Key }) =>
      pageVersions(s3, { key: Key })))

    promiseContents.push(promiseVersions)
    listParams.ContinuationToken = result.NextContinuationToken
  } while (result.IsTruncated)

  const batches = await Promise.all(promiseContents)
  return flattenDeep(batches)
}

class Store {
  constructor({ client, bucket, folder='' }) {
    this.client = client
    this.bucket = bucket
    this.folder = folder
      .replace(/^[/]+/, '')
      .replace(/[/]+$/, '')
  }

  async _get(name, version) {
    const params = {
      Bucket: this.bucket,
      Key: this._key(name)
    }

    if (typeof version !== 'undefined') {
      params.VersionId = version
    }

    try {
      const result = await this.client.getObject(params).promise()
      return unserialize(result.Body)
    } catch (err) {
      if (utils.isNotFoundError(err)) return undefined

      throw err
    }
  }

  // async _exists(name) {
  //   try {
  //     await this.client.headObject({
  //       Bucket: this.bucket,
  //       Key: [this.folder, name].join('/')
  //     })
  //     .promise()
  //   } catch(err) {
  //     if (err.code === 'NoSuchKey') {
  //       return false
  //     }

  //     throw err
  //   }

  //   return true
  // }

  getAllVersions(name, opts) {
    const options = Object.assign({}, opts)
    options.key = this._key(name)
    return pageVersions(this, options)
  }

  getAllSecretsAndVersions(opts) {
    const options = Object.assign({}, opts)
    options.prefix = this._key('')
    return pageResults(this, options)
  }

  getLatestVersion(name) {
    return this._get(name)
  }

  getByVersion(name, version) {
    throw new Error('not implemented yet')
  }

  async createSecret(item) {
    const { name, version } = item
    const existing = await this._get(name)
    if (existing && existing.version === version) {
      throw new Error(`secret already exists with name ${name}, version: ${version}`)
    }

    await this.client.putObject({
      Bucket: this.bucket,
      Key: this._key(name),
      Body: this._serialize(item),
      ContentType: 'application/octet-stream'
    })
    .promise()
  }

  _serialize(item) {
    return serialize(item)
  }

  _key(name) {
    return this.folder ? [this.folder, name].join('/') : name
  }

  async deleteSecret(name, version) {
    if (typeof version === 'undefined') {
      await this.client.deleteObject({
        Bucket: this.bucket,
        Key: this._key(name)
      })
      .promise()

      return
    }

    throw new Error('not implemented yet')
  }
}

exports = module.exports = opts => new Store(opts)
exports.serialize = serialize
exports.unserialize = unserialize
