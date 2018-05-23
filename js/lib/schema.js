
module.exports = require('protocol-buffers')(`
  enum Digest {
    sha256 = 1;
    sha512 = 2;
    md5 = 3;
  }

  message Secret {
    required string name = 1;
    required string version = 2;
    required bytes contents = 3;
    required bytes key = 4;
    required bytes hmac = 5;
    required Digest digest = 6;
  }

  message EncryptedObject {
    required bytes ciphertext = 1;
    optional bytes iv = 2;
    optional bytes tag = 3;
  }
`)
