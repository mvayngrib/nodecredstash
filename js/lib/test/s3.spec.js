'use strict';

/* eslint-disable no-unused-expressions, no-undef */

require('../../test/setup');

const crypto = require('crypto')
const _ = require('lodash');
const Store = require('../s3');

const rawAWS = require('aws-sdk')
const AWS = require('aws-sdk-mock');

let items

const hasher = data => crypto.createHash('sha256').update(data).digest('hex')
const getVersionId = item => hasher(item.name + ':' + item.version)

describe('s3 store', () => {
  const bucket = 'mybucket'
  const folder = 'myfolder'
  let store;
  let client;

  const toObject = item => ({
    Key: store._key(item.name),
    Body: Buffer.from(JSON.stringify(item)),
    VersionId: getVersionId(item) // simulate opaque version ids
  })

  const mockListObjectVersions = () => {
    AWS.mock('S3', 'listObjectsV2', (params, cb) => {
      const filtered = params.Prefix
        ? items.filter(item => item.name.startsWith(params.Prefix))
        : items.slice()

      const byName = _.groupBy(filtered, 'name')
      const maxes = []
      Object.values(byName).forEach(group => {
        maxes.push(_.maxBy(group, 'version'))
      })

      cb(null, {
        Contents: maxes.map(toObject)
      })
    })

    AWS.mock('S3', 'listObjectVersions', (params, cb) => {
      const filtered = items.filter(item => params.KeyMarker === store._key(item.name))
      cb(null, {
        Versions: filtered.map(toObject)
      })
    })
  }

  const mockGetObject = () => {
    AWS.mock('S3', 'getObject', (params, cb) => {
      const item = items.reverse().find(candidate => {
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
      return { name, version }
    });

    mockListObjectVersions()

    client = new rawAWS.S3({ region: 'us-east-1' })
    store = new Store({ client, bucket, folder, });
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
        params.Body.should.equal(JSON.stringify(item));
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
