'use strict';

const item = {
  algorithm: 'aes-256-ctr',
  name: 'quotation',
  version: '0000000000000000001',
  key: 'quotationKey',
  iv: Buffer.from('this is 16 bytes'),
  plaintext: `"Neque porro quisquam est qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit..."
"There is no one who loves pain itself, who seeks after it and wants to have it, simply because it is pain..."`,
  contents: 'gRTr/ifn6aiALfQBnFmEHUoe+O98yljkrq4+6Apcif8KCJfvkFtNnyVomD01nTm176jq+26V+gui3PpwfOLzY3OK7KUSBa8P31rd+xgccSQ++gCqWdHSEa37+D2VScovK3cKHKTJfDceypVOWbOLVDa+8hmKZo5VU9fmXItsL7OPjiBghSEkDhvnq6c3VSFLarTvaHHqQmaIVyZnYL1smdT5WtY2Oka86TgNMhY2NwT8Uetxl0ZxHbvC1lemnxbFYoBcr/u5InbPfDPcUezV:dGhpcyBpcyAxNiBieXRlcw==',
  hmacMd5: '04b92fee316d2d8c630a7d1b42b51fb9',
  hmacSha256: '84024424e3f6fd6e26efd941e0d9a9eea83a99ed7178f22f80ab42fbadc75f3c',
  hmacSha512: '158bf7dc5e45dba1e9ee46cc5a45d9c62aa44dc2aec0719f421cd1138ffce45a645a9bc0adaf60b8e8453c92dfb4b1c533bdda32ed4531bbd1ca3a80ab601d2b',
  kmsData: {
    get Plaintext() {
      return Buffer.from('Expenses as material breeding insisted building to in. Continual', 'UTF8');
    },
    get CiphertextBlob() {
      return Buffer.from('123');
    },
  },
}

const credstashKey = {
  algorithm: 'aes-256-ctr',
  name: 'some.secret.apiKey',
  contents: 'DxOwcbT+hoAp4qvCmIA=:dGhpcyBpcyAxNiBieXRlcw==',
  version: '0000000000000000001',
  hmac: 'f173a011f764cdc9066dcfcfa04f9722af495ec5bb5ac72aef680732a16f7e82',
  digest: 'SHA256',
  iv: Buffer.from('this is 16 bytes'),
  get key() {
    return Buffer.from([ 254, 231, 224, 213, 205, 4, 48, 224, 59, 181, 94, 206, 200, 202, 0, 252 ]).toString('base64');
  },
  plaintext: 'someLongAPIKey',
  kmsData: {
    get CiphertextBlob() {
      return Buffer.from([ 254, 231, 224, 213, 205, 4, 48, 224, 59, 181, 94, 206, 200, 202, 0, 252 ]);
    },
    get Plaintext() {
      return Buffer.from([ 143, 152, 50, 72, 54, 148, 70, 39, 132, 170, 101, 57, 226, 195, 170, 198, 84, 95, 89, 106, 229, 110, 193, 193, 184, 109, 87, 37, 91, 231, 132, 251, 174, 236, 20, 138, 246, 196, 219, 209, 53, 247, 142, 3, 223, 126, 160, 229, 254, 223, 168, 229, 175, 217, 85, 28, 92, 178, 198, 133, 40, 98, 142, 36 ]);
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
    contents: 'MzJ+E3ykNtOJmeyMlMtYV8tNWQRN/MxbFogMBOu/hAY1/FTciyPYOXtck94yT85ubht/DQ0tqrKz5q6lxg601Gl8bRZE6cOwXAx0CC6JF53tchijYRki4GPJ57f05e7pvYrhmRII1uSFhm5GgJEhzxVZUp1OotPYdikdPwOIcTmBfZKLlOFQF70m0XIBGhS1w6u1Vd6JmbJc12O9fOMwawbxJlZesnI1mYNul9QIWR9jipdNVdx4W1HgC+rJdFfCbVRY0m4ytu20a5hOVM8I:YSAxMiBieXRlIGl2:It+DJZcRVAOR18zlwWEfIQ==',
    hmacMd5: 'b6a896f0c578a4a63a87e471e12320ab',
    hmacSha256: 'ff293a4856ed59bad56002e86d115cfa770bb01a05f40ba7ed6bb9b1c036781f',
    hmacSha512: 'ed7dcca3e92c695a1ba73a4531c67ac02ef9e4ef1048c197972fbbf09675e2f1ff66cd7fa9644c765ef8c6a905dbf170e14c240b13978b4b9a491cf5d81a42dc',
  },
  credstashKey,
  credstashKeyCtr: credstashKey,
  credstashKeyGcm: {
    ...credstashKey,
    algorithm: 'aes-256-gcm',
    contents: 'fUWpIhmmN4DhkQOjQI0=:YSAxMiBieXRlIGl2:PmOXNGTLmMLKgW0zvjNdfw==',
    hmac: 'f173a011f764cdc9066dcfcfa04f9722af495ec5bb5ac72aef680732a16f7e82',
    digest: 'SHA256',
    iv: Buffer.from('a 12 byte iv'),
  }
};
