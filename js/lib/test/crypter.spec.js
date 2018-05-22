'use strict';

/* eslint-disable no-unused-expressions, no-undef */

require('../../test/setup');
const crypter = require('../crypter');
const defaults = require('../../defaults')
const encryption = require('../../test/utils/encryption');

const encrypter = crypter
const decrypter = crypter

describe('encrypter/decrypter', () => {
  const encryptedItem = encryption.item;
  let kmsData
  let iv
  let plaintext
  let contents
  let encrypt
  let decrypt
  let encDefaults
  let decDefaults
  beforeEach(() => {
    ({
      kmsData,
      iv,
      plaintext,
      contents,
    } = encryptedItem);

    encDefaults = { algorithm: defaults.DEFAULT_ALGORITHM, iv, kmsData, data: plaintext }
    encrypt = (opts={}) => encrypter.encrypt({ ...encDefaults, ...opts, })

    decDefaults = { algorithm: defaults.DEFAULT_ALGORITHM, kmsData }
    decrypt = (opts={}) => decrypter.decrypt({ ...decDefaults, ...opts, })
  })

  describe('#encrypt', () => {
    it(`can encrypt ${encryptedItem.name} with default HMAC`, () => {
      const encrypted = encrypt();
      encrypted.contents.should.equal(encryptedItem.contents);
      encrypted.hmac.should.equal(encryptedItem.hmacSha256);
    });

    it(`can encrypt ${encryptedItem.name} with explicit SHA256 HMAC`, () => {
      const encrypted = encrypt({ digest: 'SHA256' });
      encrypted.contents.should.equal(encryptedItem.contents);
      encrypted.hmac.should.equal(encryptedItem.hmacSha256);
    });

    it(`can encrypt ${encryptedItem.name} with SHA512 HMAC`, () => {
      const encrypted = encrypt({ digest: 'SHA512' });
      encrypted.contents.should.equal(encryptedItem.contents);
      encrypted.hmac.should.equal(encryptedItem.hmacSha512);
    });

    it(`can encrypt ${encryptedItem.name} with MD5 HMAC`, () => {
      const encrypted = encrypt({ digest: 'MD5' });
      encrypted.contents.should.equal(encryptedItem.contents);
      encrypted.hmac.should.equal(encryptedItem.hmacMd5);
    });
  });

  describe('#encryptAes', () => {
    const encryptAes = encrypter.encryptAes.bind(encrypter);
    const item = encryption.credstashKey;

    it('correctly encrypts a key', () => {
      const encrypted = encryptAes({
        algorithm: defaults.DEFAULT_ALGORITHM,
        key: item.kmsData.Plaintext.slice(0, 32),
        data: item.plaintext,
        iv
      });

      encrypted.should.equal(item.contents);
    });
  });

  describe('#decrypt', () => {
    it(`can decrypt ${encryptedItem.name} with default digest`, () => {
      const stash = {
        name: 'item',
        hmac: encryptedItem.hmacSha256,
        contents: encryptedItem.contents,
      };

      const decrypted = decrypt({ item: stash });
      decrypted.should.equal(plaintext);
    });

    it(`can decrypt ${encryptedItem.name} with explicit SHA256 digest`, () => {
      const stash = {
        name: 'item',
        hmac: encryptedItem.hmacSha256,
        contents: encryptedItem.contents,
        digest: 'SHA256',
      };

      const decrypted = decrypt({ item: stash });
      decrypted.should.equal(plaintext);
    });

    it(`can decrypt ${encryptedItem.name} with SHA512 digest`, () => {
      const stash = {
        name: 'item',
        hmac: encryptedItem.hmacSha512,
        contents: encryptedItem.contents,
        digest: 'SHA512',
      };

      const decrypted = decrypt({ item: stash });
      decrypted.should.equal(plaintext);
    });

    it(`can decrypt ${encryptedItem.name} with MD5 digest`, () => {
      const stash = {
        name: 'item',
        hmac: encryptedItem.hmacMd5,
        contents: encryptedItem.contents,
        digest: 'MD5',
      };

      const decrypted = decrypt({ item: stash });
      decrypted.should.equal(plaintext);
    });

    it('will throw an exception if the contents has been messed with', () => {
      const stash = {
        name: 'item',
        hmac: encryptedItem.hmacMd5,
        contents: `${encryptedItem.contents}some junk`,
        digest: 'MD5',
      };

      try {
        const decrypted = decrypt({ item: stash });
        decrypted.should.not.exist;
      } catch (e) {
        e.message.should.contain('does not match stored HMAC');
      }
    });
  });

  describe('#decryptAes', () => {
    const decryptAes = decrypter.decryptAes.bind(decrypter);
    const credstashItem = encryption.credstashKey;

    it('correctly encrypts a key', () => {
      const decrypted = decryptAes({
        algorithm: defaults.DEFAULT_ALGORITHM,
        key: credstashItem.kmsData.Plaintext.slice(0, 32),
        data: credstashItem.contents,
        iv
      });

      decrypted.should.equal(credstashItem.plaintext);
    });
  });
});
