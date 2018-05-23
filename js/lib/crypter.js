'use strict'

const pick = require('lodash/pick')
const crypto = require('crypto')
const utils = require('./utils')
const schema = require('./schema')

// const CIPHERTEXT_ENCODING = 'base64'
const PLAINTEXT_ENCODING = 'utf8'
const ALG_CTR = 'aes-256-ctr'
const ALG_GCM = 'aes-256-gcm'

const ENCRYPTED_OBJECT_KEYS = [
  'ciphertext',
  'iv',
  'tag'
]

const createIV = bytes => crypto.randomBytes(bytes)
const serializeEncrypted = parts =>
  schema.EncryptedObject.encode(pick(parts, ENCRYPTED_OBJECT_KEYS))

const unserializeEncrypted = buf => schema.EncryptedObject.decode(buf)
const requireOption = (name, value) => {
  if (!value) throw new Error(`missing option "${name}"`)
}

class Crypter {
  constructor(algorithm) {
    if (algorithm !== ALG_CTR && algorithm !== ALG_GCM) {
      throw new Error(`unsupported algorithm: ${algorithm}`)
    }

    this.algorithm = algorithm
  }

  encryptAes(...args) {
    if (this.algorithm === ALG_CTR) {
      return this.encryptCtr(...args)
    }

    if (this.algorithm === ALG_GCM) {
      return this.encryptGcm(...args)
    }
  }

  encryptCtr({ key, data, iv=createIV(16) }) {
    const cipher = crypto.createCipheriv(ALG_CTR, key, iv)
    const ciphertext = Buffer.concat([
      cipher.update(data, PLAINTEXT_ENCODING),
      cipher.final()
    ])

    return serializeEncrypted({ ciphertext, iv })
  }

  encryptGcm({ key, data, iv=createIV(12) }) {
    const cipher = crypto.createCipheriv(ALG_GCM, key, iv)
    const ciphertext = Buffer.concat([
      cipher.update(data, PLAINTEXT_ENCODING),
      cipher.final()
    ])

    const tag = cipher.getAuthTag()
    return serializeEncrypted({ ciphertext, iv, tag })
  }

  encrypt({ data, kmsData, digest, iv }) {
    requireOption('data', data)
    requireOption('kmsData', kmsData)
    requireOption('digest', digest)

    if (!Buffer.isBuffer(data)) {
      throw new Error('expected buffer "data"')
    }

    const keys = utils.splitKmsKey(kmsData.Plaintext)
    const wrappedKey = kmsData.CiphertextBlob
    const key = utils.b64decode(wrappedKey)
    const contents = this.encryptAes({
      key: keys.dataKey,
      data,
      iv
    })

    // compute an HMAC using the hmac key and the ciphertext
    const hmac = utils.calculateHmac(digest, keys.hmacKey, contents)

    return {
      contents,
      hmac,
      key,
      digest,
    }
  }

  decryptCtr({ key, data }) {
    const { ciphertext, iv } = unserializeEncrypted(data)
    const decipher = crypto.createDecipheriv(ALG_CTR, key, iv)
    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final()
    ])
  }

  decryptGcm({ key, data }) {
    const { ciphertext, iv, tag } = unserializeEncrypted(data)
    const decipher = crypto.createDecipheriv(ALG_GCM, key, iv)
    decipher.setAuthTag(tag)

    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final()
    ])
  }

  decryptAes(...args) {
    if (this.algorithm === ALG_CTR) {
      return this.decryptCtr(...args)
    }

    if (this.algorithm === ALG_GCM) {
      return this.decryptGcm(...args)
    }
  }

  decrypt({ item, kmsData }) {
    const {
      name,
      contents,
      hmac,
      digest,
    } = item

    const keys = utils.splitKmsKey(kmsData.Plaintext)

    const hmacCalc = utils.calculateHmac(digest, keys.hmacKey, contents)

    if (!hmacCalc.equals(hmac)) {
      throw new Error(`Computed HMAC on ${name} does not match stored HMAC`)
    }

    return this.decryptAes({ key: keys.dataKey, data: contents })
  }
}

module.exports = {
  Crypter,
  encrypt({ algorithm, ...rest }) {
    return new Crypter(algorithm).encrypt(rest)
  },
  encryptAes({ algorithm, ...rest }) {
    return new Crypter(algorithm).encryptAes(rest)
  },
  decrypt({ algorithm, ...rest }) {
    return new Crypter(algorithm).decrypt(rest)
  },
  decryptAes({ algorithm, ...rest }) {
    return new Crypter(algorithm).decryptAes(rest)
  },
}
