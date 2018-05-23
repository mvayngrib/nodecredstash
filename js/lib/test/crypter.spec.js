'use strict';

/* eslint-disable no-unused-expressions, no-undef */

require('../../test/setup');
const crypter = require('../crypter');
const defaults = require('../../defaults')
const encryption = require('../../test/utils/encryption');

const encrypter = crypter
const decrypter = crypter

;[encryption.itemCtr, encryption.itemGcm].forEach(encryptedItem => {
  describe(`encrypter/decrypter ${encryptedItem.algorithm}`, () => {
    let algorithm
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
        algorithm,
      } = encryptedItem);

      encDefaults = { algorithm, iv, kmsData, data: plaintext }
      encrypt = (opts={}) => encrypter.encrypt({ ...encDefaults, ...opts, })

      decDefaults = { algorithm, kmsData }
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
  });
})

;[encryption.credstashKeyCtr, encryption.credstashKeyGcm].forEach(credstashKey => {
  describe(`low level ${credstashKey.algorithm}`, () => {
    const {
      algorithm,
      iv,
    } = credstashKey

    describe('#encryptAes', () => {
      const encryptAes = encrypter.encryptAes.bind(encrypter);
      const item = credstashKey;

      it('correctly encrypts a key', () => {
        const encrypted = encryptAes({
          algorithm,
          key: item.kmsData.Plaintext.slice(0, 32),
          data: item.plaintext,
          iv
        });

        encrypted.should.equal(item.contents);
      });
    });

    describe('#decryptAes', () => {
      const decryptAes = decrypter.decryptAes.bind(decrypter);
      const credstashItem = credstashKey;

      it('correctly encrypts a key', () => {
        const decrypted = decryptAes({
          algorithm,
          key: credstashItem.kmsData.Plaintext.slice(0, 32),
          data: credstashItem.contents,
          iv
        });

        decrypted.should.equal(credstashItem.plaintext);
      });
    });
  })
})
