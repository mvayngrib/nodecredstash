'use strict'

const crypto = require('crypto')
const utils = require('./utils')

const CIPHERTEXT_ENCODING = 'base64'
const PLAINTEXT_ENCODING = 'utf8'
const ALG_CTR = 'aes-256-ctr'
const ALG_GCM = 'aes-256-gcm'

const createIV = bytes => crypto.randomBytes(bytes)
const serialize = (...parts) => parts
  .map(part => {
    if (typeof part === 'string') return part

    return part.toString(CIPHERTEXT_ENCODING)
  })
  .join(':')

const unserialize = str => str
  .split(':')
  .map(part => utils.b64decode(part))


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
    const ciphertext = cipher.update(data, PLAINTEXT_ENCODING, CIPHERTEXT_ENCODING) +
      cipher.final(CIPHERTEXT_ENCODING)

    return serialize(ciphertext, iv)
  }

  encryptGcm({ key, data, iv=createIV(12) }) {
    const cipher = crypto.createCipheriv(ALG_GCM, key, iv)
    const ciphertext = cipher.update(data, PLAINTEXT_ENCODING, CIPHERTEXT_ENCODING) +
      cipher.final(CIPHERTEXT_ENCODING)

    const tag = cipher.getAuthTag()
    return serialize(ciphertext, iv, tag)
  }

  encrypt({ digest, data, iv, kmsData }) {
    const keys = utils.splitKmsKey(kmsData.Plaintext)

    const wrappedKey = kmsData.CiphertextBlob

    const key = utils.b64encode(wrappedKey)

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
    const [ciphertext, iv] = unserialize(data)
    const decipher = crypto.createDecipheriv(ALG_CTR, key, iv)
    return decipher.update(ciphertext, CIPHERTEXT_ENCODING, PLAINTEXT_ENCODING) +
      decipher.final(PLAINTEXT_ENCODING)
  }

  decryptGcm({ key, data }) {
    const [ciphertext, iv, tag] = unserialize(data)
    const decipher = crypto.createDecipheriv(ALG_GCM, key, iv)
    decipher.setAuthTag(tag)

    return decipher.update(ciphertext, CIPHERTEXT_ENCODING, PLAINTEXT_ENCODING) +
      decipher.final(PLAINTEXT_ENCODING)
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

    if (hmacCalc != hmac) {
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
