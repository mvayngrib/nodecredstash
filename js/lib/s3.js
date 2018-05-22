
// const splitPath = path => {
//   const idx = path.indexOf('/')
//   if (idx) {
//     return {
//       bucket: path.slice(0, idx),
//       folder: path.slice(idx)
//     }
//   }

//   return {
//     bucket: path,
//     folder: '/'
//   }
// }

const flatten = arr => arr.reduce((all, batch) => all.concat(batch), []);

async function pageVersions ({ client, bucket }, opts={}) {
  const { key, limit=0 } = opts
  const Bucket = bucket
  const listParams = {
    Bucket,
    KeyMarker: key,
    MaxKeys: limit
  }

  const promiseContents = []
  let result
  let promiseVersions
  do {
    result = await client.listObjectVersions(listParams).promise()
    promiseVersions = Promise.all(result.Versions.map(({ VersionId }) =>
      client.getObject({ Bucket, Key: key, VersionId })))

    promiseVersions.push(promiseVersions)
    if (result.NextKeyMarker && result.NextKeyMarker !== key) {
      break
    }

    listParams.VersionIdMarker = result.NextVersionIdMarker
  } while (result.IsTruncated)

  const batches = await Promise.all(promiseContents)
  return flatten(batches)
}

async function pageResults (s3, opts={}) {
  const { client, bucket } = s3
  const { prefix, limit=0 } = opts
  const Bucket = bucket
  const listParams = {
    Bucket,
    Prefix: prefix,
    MaxKeys: limit
  }

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
  return flatten(batches)
}

class S3 {
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
      Key: [this.folder, name].join('/'),
    }

    if (typeof version !== 'undefined') {
      params.VersionId = version
    }

    const { Body } = await this.client.getObject(params)
    return JSON.parse(Body)
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
    options.key = [this.folder, name].join('/')
    return pageVersions(this, options)
  }

  getAllSecretsAndVersions(opts) {
    const options = Object.assign({}, opts)
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
      Body: JSON.stringify(item),
      ContentType: 'application/json'
    })
    .promise()
  }

  _key(name) {
    return [this.folder, name].join('/')
  }

  async deleteSecret(name, version) {
    if (typeof version === 'undefined') {
      await this.client.deleteObject({
        Bucket: this.bucket,
        Key: [this.folder, name, version].join('/'),
      })
      .promise()

      return
    }

    throw new Error('not implemented yet')
  }
}

module.exports = S3
