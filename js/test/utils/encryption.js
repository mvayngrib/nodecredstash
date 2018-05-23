'use strict';

const utils = require('../../lib/utils')

const item = {
  algorithm: 'aes-256-ctr',
  name: 'quotation',
  version: '0000000000000000001',
  iv: Buffer.from('this is 16 bytes'),
  key: Buffer.from('123'),
  plaintext: Buffer.from(`"Neque porro quisquam est qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit..."
"There is no one who loves pain itself, who seeks after it and wants to have it, simply because it is pain..."`),
  contents: utils.b64decode('Cs8BgRTr/ifn6aiALfQBnFmEHUoe+O98yljkrq4+6Apcif8KCJfvkFtNnyVomD01nTm176jq+26V+gui3PpwfOLzY3OK7KUSBa8P31rd+xgccSQ++gCqWdHSEa37+D2VScovK3cKHKTJfDceypVOWbOLVDa+8hmKZo5VU9fmXItsL7OPjiBghSEkDhvnq6c3VSFLarTvaHHqQmaIVyZnYL1smdT5WtY2Oka86TgNMhY2NwT8Uetxl0ZxHbvC1lemnxbFYoBcr/u5InbPfDPcUezVEhB0aGlzIGlzIDE2IGJ5dGVz'),
  hmacMd5: utils.b64decode('wj8Y34Zao34aOvOT7yqQ4Q=='),
  hmacSha256: utils.b64decode('mz3sa0OnjfAwCPgWeK6w4tj7u8dOKjVxrHcA480HRIQ='),
  hmacSha512: utils.b64decode('YTC/sUVqZHjlqxjmKQT9N++kkLGSPjEISGcVrt2R/E6kVeT3bsIQ3lu7Kpv09aVgHOoVHRPqiNBe62Di0orqlA=='),
  kmsData: {
    get Plaintext() {
      return Buffer.from('Expenses as material breeding insisted building to in. Continual');
    },
    get CiphertextBlob() {
      return Buffer.from('123');
    },
  },
}

const credstashKey = {
  algorithm: 'aes-256-ctr',
  name: 'some.secret.apiKey',
  contents: utils.b64decode('Cg4PE7BxtP6GgCniq8KYgBIQdGhpcyBpcyAxNiBieXRlcw=='),
  hmac: utils.b64decode('oe2Hxme5lBBo/qwMbxcWsEkr64OQbKOqVY1Rp8RJ568='),
  version: '0000000000000000001',
  digest: 'SHA256',
  iv: Buffer.from('this is 16 bytes'),
  key: utils.b64decode('/ufg1c0EMOA7tV7OyMoA/A=='),
  plaintext: Buffer.from('someLongAPIKey'),
  kmsData: {
    get CiphertextBlob() {
      return credstashKey.key;
    },
    get Plaintext() {
      return Buffer.from([143, 152, 50, 72, 54, 148, 70, 39, 132, 170, 101, 57, 226, 195, 170, 198, 84, 95, 89, 106, 229, 110, 193, 193, 184, 109, 87, 37, 91, 231, 132, 251, 174, 236, 20, 138, 246, 196, 219, 209, 53, 247, 142, 3, 223, 126, 160, 229, 254, 223, 168, 229, 175, 217, 85, 28, 92, 178, 198, 133, 40, 98, 142, 36]);
    },
  },
}

module.exports = {
  item,
  itemCtr: item,
  itemGcm: {
    ...item,
    algorithm: 'aes-256-gcm',
    iv: Buffer.from('a 12 byte iv'),
    contents: utils.b64decode('Cs8BMzJ+E3ykNtOJmeyMlMtYV8tNWQRN/MxbFogMBOu/hAY1/FTciyPYOXtck94yT85ubht/DQ0tqrKz5q6lxg601Gl8bRZE6cOwXAx0CC6JF53tchijYRki4GPJ57f05e7pvYrhmRII1uSFhm5GgJEhzxVZUp1OotPYdikdPwOIcTmBfZKLlOFQF70m0XIBGhS1w6u1Vd6JmbJc12O9fOMwawbxJlZesnI1mYNul9QIWR9jipdNVdx4W1HgC+rJdFfCbVRY0m4ytu20a5hOVM8IEgxhIDEyIGJ5dGUgaXYaECLfgyWXEVQDkdfM5cFhHyE='),
    hmacMd5: utils.b64decode('zVajCw6+w/1QzDtlLs5ZcA=='),
    hmacSha256: utils.b64decode('UqYldMUwBRtOzMtF74LtDZfRwr1GuIZeN5kBJD4vBfg='),
    hmacSha512: utils.b64decode('ZV0EJOdG3Lx1nLDnwSzhh6ILGygVqBoEhU77Sn/XmYmVPQ8yG0SBFSDielXbOkcqTeWhphBLFuj/8XLgfA11Bg=='),
  },
  credstashKey,
  credstashKeyCtr: credstashKey,
  credstashKeyGcm: {
    ...credstashKey,
    algorithm: 'aes-256-gcm',
    contents: utils.b64decode('Cg59RakiGaY3gOGRA6NAjRIMYSAxMiBieXRlIGl2GhA+Y5c0ZMuYwsqBbTO+M11/'),
    hmac: utils.b64decode('5CMA34CXp6lnJz+rb/x8lqXSq/tuLXZHqi49EBluCQk='),
    digest: 'SHA256',
    iv: Buffer.from('a 12 byte iv'),
  }
};
