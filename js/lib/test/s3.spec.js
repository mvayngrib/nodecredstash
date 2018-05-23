'use strict';

/* eslint-disable no-unused-expressions, no-undef */

require('../../test/setup');

const crypto = require('crypto')
const _ = require('lodash');
const createS3Store = require('../s3');

const rawAWS = require('aws-sdk')
const AWS = require('aws-sdk-mock');

let items

const hasher = data => crypto.createHash('sha256').update(data).digest('hex')
const getVersionId = item => hasher(item.name + ':' + item.version)
const getContinuationToken = item => hasher(getVersionId(item))
const getVersionIdMarker = item => hasher(getVersionId(item))

describe('s3 store', () => {
  const bucket = 'mybucket'
  const folder = 'myfolder'
  let store;
  let client;

  const toObject = item => ({
    Key: store._key(item.name),
    Body: store._serialize(item),
    VersionId: getVersionId(item) // simulate opaque version ids
  })

  const mockListObjectVersions = () => {
    const pageSize = 1

    AWS.mock('S3', 'listObjectsV2', (params, cb) => {
      const filtered = params.Prefix
        ? items.filter(item => item.name.startsWith(params.Prefix))
        : items.slice()

      const byName = _.groupBy(filtered, 'name')
      let results = []
      Object.values(byName).forEach(group => {
        results.push(_.maxBy(group, 'version'))
      })

      if (params.ContinuationToken) {
        const offset = results.findIndex(item =>
          getContinuationToken(item) === params.ContinuationToken)

        results = results.slice(offset)
      }

      let NextContinuationToken
      const nextPageTopItem = results[pageSize]
      if (nextPageTopItem) {
        NextContinuationToken = getContinuationToken(nextPageTopItem)
      }

      const IsTruncated = results.length > pageSize
      results = results.slice(0, pageSize)
      cb(null, {
        IsTruncated,
        NextContinuationToken,
        Contents: results.map(toObject)
      })
    })

    AWS.mock('S3', 'listObjectVersions', (params, cb) => {
      let results = items.filter(item => params.KeyMarker === store._key(item.name))
      let NextVersionIdMarker
      if (params.VersionIdMarker) {
        const offset = results.findIndex(item =>
          getVersionIdMarker(item) === params.VersionIdMarker)

        results = results.slice(offset)
      }

      const nextPageTopItem = results[pageSize]
      if (nextPageTopItem) {
        NextVersionIdMarker = getVersionIdMarker(nextPageTopItem)
      }

      const IsTruncated = results.length > pageSize
      results = results.slice(0, pageSize)
      cb(null, {
        IsTruncated,
        NextVersionIdMarker,
        Versions: results.map(toObject)
      })
    })
  }

  const mockGetObject = () => {
    AWS.mock('S3', 'getObject', (params, cb) => {
      const item = items.slice().reverse().find(candidate => {
        if (params.VersionId) {
          return getVersionId(candidate) === params.VersionId
        }

        return store._key(candidate.name) === params.Key
      })

      if (item) return cb(null, toObject(item))

      const notFound = new Error(params.Key)
      notFound.code = 'NoSuchKey'
      cb(notFound)
    })
  }

  beforeEach(() => {
    AWS.restore();

    let prevName
    items = Array.from({ length: 30 }, (v, i) => {
      const name = String(Math.ceil((i + 1) / 10))
      prevName = i ? String(Math.ceil(i / 10)) : name
      const version = name === prevName ? i % 10 : 0
      const id = getVersionId({ name, version })
      return {
        name,
        version: String(version),
        key: Buffer.from('some key' + id),
        contents: Buffer.from('some ciphertext' + id),
        hmac: Buffer.from('some hmac' + id),
        digest: 'sha256',
      }
    });

    mockListObjectVersions()

    client = new rawAWS.S3({ region: 'us-east-1' })
    store = createS3Store({ client, bucket, folder, });
  });

  afterEach(() => {
    AWS.restore();
  });

  // uncomment after implementing getAllSecretsAndVersions
  describe('#getAllSecretsAndVersions', () => {
    it('should properly page through versions of all secrets', async () => {
      mockGetObject()
      const secrets = await store.getAllSecretsAndVersions({ limit: 10 })
      secrets.length.should.be.equal(items.length);
      secrets.should.eql(items);
    });
  });

  describe('#getAllVersions', () => {
    it('should properly page through versions', async () => {
      mockGetObject()
      const { name } = items[0]
      const secrets = await store.getAllVersions(name, { limit: 10 })
      const expected = items.filter(item => item.name === name)
      secrets.length.should.be.equal(expected.length);
      secrets.should.eql(expected);
    });
  });

  describe('#getLatestVersion', () => {
    it('should only get one item back', async () => {
      mockGetObject()
      const { name } = items[0]
      const item = await store.getLatestVersion(name)
      expect(item).to.exist;
    });
  });

  // uncomment after implementing getByVersion
  // describe('#getByVersion', () => {
  //   it('should only get one item back', async () => {
  //     const name = 'name';
  //     const version = 'version';
  //     // AWS.mock('DynamoDB.DocumentClient', 'get', (params, cb) => {
  //     //   params.TableName.should.equal(TableName);
  //     //   expect(params.Key).to.exist;
  //     //   params.Key.name.should.equal(name);
  //     //   params.Key.version.should.equal(version);
  //     //   cb(undefined, { Item: 'Success' });
  //     // });

  //     const item = await store.getByVersion(name, version)
  //     expect(item).to.equal('Success');
  //   });
  // });

  describe('#createSecret', () => {
    it('should create an item in S3', async () => {
      const item = items[0];

      let put
      AWS.mock('S3', 'getObject', (params, cb) => {
        if (put) {
          return cb(null, toObject(item))
        }

        const notFound = new Error(params.Key)
        notFound.code = 'NoSuchKey'
        cb(notFound)
      })

      AWS.mock('S3', 'putObject', (params, cb) => {
        params.Bucket.should.equal(bucket);
        params.Key.should.equal(folder + '/' + item.name);
        params.Body.should.deep.equal(store._serialize(item));
        put = true
        cb();
      });

      await store.createSecret(item)
      const saved = await store.getLatestVersion(item.name)
      saved.should.deep.equal(item)
    });
  });

  describe('#deleteSecret', () => {
    it('should delete the secret by name and version', async () => {
      const name = 'name';
      const version = 'version';

      let exists
      AWS.mock('S3', 'getObject', (params, cb) => {
        if (exists) {
          return cb(null, toObject({ name, version }))
        }

        const notFound = new Error(params.Key)
        notFound.code = 'NoSuchKey'
        cb(notFound)
      })

      AWS.mock('S3', 'deleteObject', (params, cb) => {
        params.Bucket.should.equal(bucket)
        params.Key.should.equal(folder + '/' + name);
        exists = false
        cb()
      });

      await store.deleteSecret(name)
      const deleted = await store.getLatestVersion(name)
      expect(deleted).to.not.exist
    });
  });
});
