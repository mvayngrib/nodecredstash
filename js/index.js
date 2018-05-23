'use strict'

const debug = require('debug')('credstash')

const createDynamoDBStore = require('./lib/dynamoDb')
const createS3Store = require('./lib/s3')
const KMS = require('./lib/kms')

const { Crypter } = require('./lib/crypter')
const defaults = require('./defaults')
const utils = require('./lib/utils')
const Errors = require('./lib/errors')

class Credstash {
  constructor({ kms, store, key, crypter }) {
    this.kms = kms
    this.store = store
    this.key = key
    this.crypter = crypter

    const credstash = this
    Object.getOwnPropertyNames(Credstash.prototype).forEach(methodName => {
      const method = credstash[methodName]
      credstash[methodName] = function () {
        const args = Array.from(arguments)
        const lastArg = args.slice(-1)[0]
        let cb
        if (typeof lastArg === 'function') {
          cb = args.pop()
        }

        return method.apply(credstash, args)
          .then((res) => {
            if (cb) {
              return cb(undefined, res)
            }
            return res
          })
          .catch((err) => {
            if (cb) {
              return cb(err)
            }
            throw err
          })
      }
    })

    this.paddedInt = utils.paddedInt

    // this.getConfiguration = () => {
    //   const ddbOptsCopy = Object.assign({}, ddbOpts)
    //   const kmsOptsCopy = Object.assign({}, kmsOpts)
    //   const configCopy = Object.assign({}, config)

    //   const configuration = {
    //     config: configCopy,
    //     dynamoConfig: {
    //       table,
    //       opts: ddbOptsCopy,
    //     },
    //     kmsConfig: {
    //       kmsKey,
    //       opts: kmsOptsCopy,
    //     },
    //   }
    //   return configuration
    // }
  }

  /**
   * Retrieve the highest version of `name` in the table
   *
   * @param opts
   * @returns {Promise.<number>}
   */

  async getHighestVersion(opts) {
    const options = Object.assign({}, opts)
    const { name } = options
    if (!name) {
      throw new Error('"name" is a required parameter')
    }

    const res = await this.store.getLatestVersion(name)
    const { version = 0 } = res || {}
    return version
  }

  async incrementVersion(opts) {
    const version = await this.getHighestVersion(opts)
    const vInt = Number.parseInt(version, 10)
    if (vInt == version) {
      return utils.paddedInt(defaults.PAD_LEN, vInt + 1)
    }

    throw new Error(`Can not autoincrement version. The current version: ${version} is not an int`)
  }

  // alias
  put(opts) {
    return this.putSecret(opts)
  }

  async putSecret(opts) {
    const options = Object.assign({}, opts)
    const {
      name,
      secret,
      context,
      digest = defaults.DEFAULT_DIGEST,
      iv // optional
    } = options

    if (!name) {
      throw new Error('name is a required parameter')
    }

    if (!secret) {
      throw new Error('secret is a required parameter')
    }

    if (!Buffer.isBuffer(secret)) {
      throw new Error('expected "secret" to be a Buffer')
    }

    const version = utils.sanitizeVersion(options.version, 1) // optional
    let kmsData
    try {
      kmsData = await this.kms.getEncryptionKey(context)
    } catch (err) {
      if (err.code == 'NotFoundException') {
        throw err
      }

      throw new Error(`Could not generate key using KMS key ${this.key}, error:${JSON.stringify(err, null, 2)}`)
    }

    const data = await this.crypter.encrypt({ digest, data: secret, kmsData, iv })
    const secretOpts = Object.assign({ name, version }, data)
    try {
      return await this.store.createSecret(secretOpts)
    } catch (err) {
      if (err.code == 'ConditionalCheckFailedException') {
        throw new Error(`${name} version ${version} is already in the credential store.`)
      } else {
        throw err
      }
    }
  }
  async decryptStash(stash, context) {
    const { key } = stash
    try {
      return await this.kms.decrypt(key, context)
    } catch (err) {
      let msg = `Decryption error: ${JSON.stringify(err, null, 2)}`

      if (err.code == 'InvalidCiphertextException') {
        if (context) {
          msg = 'Could not decrypt hmac key with KMS. The encryption ' +
            'context provided may not match the one used when the ' +
            'credential was stored.'
        } else {
          msg = 'Could not decrypt hmac key with KMS. The credential may ' +
            'require that an encryption context be provided to decrypt ' +
            'it.'
        }
      }

      throw new Error(msg)
    }
  }

  async getAllVersions(opts) {
    const options = Object.assign({}, opts)
    const {
      name,
      context, // optional
      limit, // optional
    } = options

    if (!name) {
      throw new Error('"name" is a required parameter')
    }

    const results = await this.store.getAllVersions(name, { limit })
    const dataKeyPromises = results.map(async (stash) => {
      const decryptedDataKey = await this.decryptStash(stash, context)
      return Object.assign(stash, { decryptedDataKey })
    })

    const stashes = await Promise.all(dataKeyPromises)
    return stashes.map(stash => ({
      version: stash.version,
      secret: this.crypter.decrypt({ item: stash, kmsData: stash.decryptedDataKey }),
    }))
  }

  // alias
  get(opts) {
    return this.getSecret(opts)
  }

  async getSecret(opts) {
    const options = Object.assign({}, opts)
    const {
      name,
      context,
    } = options
    if (!name) {
      throw new Error('"name" is a required parameter')
    }

    const version = utils.sanitizeVersion(options.version) // optional
    const promiseStash = version == undefined
      ? this.store.getLatestVersion(name)
      : this.store.getByVersion(name, version)

    const stash = await promiseStash
    if (!(stash && stash.key)) {
      throw new Errors.NotFound(`Item {'name': '${name}'} could not be found.`)
    }

    const [item, kmsData] = await Promise.all([
      stash,
      this.decryptStash(stash, context),
    ])

    return this.crypter.decrypt({ item, kmsData })
  }

  async deleteSecrets(opts) {
    const options = Object.assign({}, opts)
    const {
      name,
    } = options

    if (!name) {
      throw new Error('"name" is a required parameter')
    }

    const secrets = await this.store.getAllVersions(name)
    await utils.series(secrets, secret => this.deleteSecret({
      name: secret.name,
      version: secret.version,
    }))
  }

  async deleteSecret(opts) {
    const options = Object.assign({}, opts)
    const {
      name,
    } = options

    if (!name) {
      throw new Error('"name" is a required parameter')
    }

    const version = utils.sanitizeVersion(options.version)
    if (!version) {
      throw new Error('"version" is a required parameter')
    }

    debug(`Deleting ${name} -- version ${version}`)
    return this.store.deleteSecret(name, version)
  }

  // alias
  list(opts) {
    return this.listSecrets(opts)
  }

  async listSecrets(opts={}) {
    if (opts.name) return this.store.getAllVersions(opts.name)

    const res = await this.store.getAllSecretsAndVersions()
    return res.slice().sort(utils.sortSecrets)
  }

  async getAllSecrets(opts) {
    const options = Object.assign({}, opts)
    const {
      version,
      context,
      startsWith,
    } = options

    const unOrdered = {}
    const position = {}

    let secrets = await this.listSecrets()
    secrets = secrets
      .filter(secret => secret.version == (version || secret.version))
      .filter(secret => !startsWith || secret.name.startsWith(startsWith))
      .filter(next => {
        if (position[next.name]) return false

        position[next.name] = next
        return true
      })

    await utils.series(secrets, async (secret) => {
      try {
        const plaintext = await this.getSecret({ name: secret.name, version: secret.version, context })
        unOrdered[secret.name] = plaintext
      } catch (err) {
        // ignore
      }
    })

    const ordered = {}
    Object.keys(unOrdered).sort().forEach((key) => {
      ordered[key] = unOrdered[key]
    })

    return ordered
  }

  createDdbTable() {
    if (this.store.createTable) {
      return this.store.createTable()
    }

    throw new Error('not supported')
  }
}

exports = module.exports = function (mainConfig) {
  const config = Object.assign({}, mainConfig)
  let { store } = config
  // backwards compat
  if (!store && (config.table || config.dynamoOpts)) {
    const table = config.table || defaults.DEFAULT_TABLE
    const ddbOpts = Object.assign({}, config.awsOpts, config.dynamoOpts)
    store = createDynamoDBStore(table, ddbOpts)
  }

  if (!store) {
    throw new Error('expected "store" or store options')
  }

  const kmsKey = config.kmsKey || defaults.DEFAULT_KMS_KEY
  const kmsOpts = Object.assign({}, config.awsOpts, config.kmsOpts)
  const kms = new KMS(kmsKey, kmsOpts)
  const { algorithm = defaults.DEFAULT_ALGORITHM } = config
  const crypter = new Crypter(algorithm)
  return new Credstash({ key: kmsKey, kms, store, crypter })
}

exports.Credstash = Credstash
exports.Errors = Errors
exports.utils = utils
exports.store = {
  dynamodb: createDynamoDBStore,
  s3: createS3Store
}
