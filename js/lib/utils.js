'use strict'

const crypto = require('crypto')
const defaults = require('../defaults')
const Errors = require('./errors')

const utils = {
  isNotFoundError(err) {
    return err.code === 'ResourceNotFoundException' || err.code === 'NoSuchKey'
  },

  normalizeError(err) {
    if (utils.isNotFoundError(err)) {
      return new Errors.NotFound(err.message)
    }

    return err
  },

  calculateHmac(digestArg, key, encrypted) {
    const digest = digestArg || defaults.DEFAULT_DIGEST
    // compute an HMAC using the hmac key and the ciphertext
    return crypto.createHmac(digest.toLowerCase(), key)
      .update(encrypted) // utf8
      .digest()
  },

  splitKmsKey(buffer) {
    const dataKey = buffer.slice(0, 32)
    const hmacKey = buffer.slice(32)
    return {
      dataKey, hmacKey,
    }
  },

  sanitizeVersion(version, defaultVersion) {
    let sanitized = version
    if (defaultVersion && sanitized == undefined) {
      sanitized = sanitized || 1
    }

    if (typeof sanitized == 'number') {
      sanitized = utils.paddedInt(defaults.PAD_LEN, sanitized)
    }

    sanitized = (sanitized == undefined) ? sanitized : `${sanitized}`
    return sanitized
  },

  b64decode(string) {
    return Buffer.from(string, 'base64')
  },

  b64encode(buffer) {
    return Buffer.from(buffer).toString('base64')
  },

  paddedInt(padLength, i) {
    const iStr = `${i}`
    let pad = padLength - iStr.length
    pad = pad < 0 ? 0 : pad
    return `${'0'.repeat(pad)}${iStr}`
  },

  sortSecrets(a, b) {
    const nameDiff = a.name.localeCompare(b.name)
    return nameDiff || b.version.localeCompare(a.version)
  },

  asPromise() {
    const args = Array.from(arguments)
    const that = args.shift()
    const fn = args.shift()

    return new Promise((resolve, reject) => {
      fn.apply(that, args.concat((err, res) => {
        if (err) {
          return reject(err)
        }
        return resolve(res)
      }))
    })
  },

  series(array, fn) {
    let idx = 0
    const results = []

    function doNext() {
      if (idx >= array.length) {
        return results
      }

      return fn(array[idx])
        .then((res) => {
          idx += 1
          results.push(res)
        })
        .then(() => doNext())
    }

    return doNext()
  },

  keyByValue(obj, value) {
    return Object.keys(obj).find(key => obj[key] === value)
  },
}

module.exports = utils
