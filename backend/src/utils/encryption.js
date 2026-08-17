const Iron = require('@hapi/iron');

function getEncryptionKey() {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY is missing');
  }
  return key;
}

async function encryptToken(token) {
  if (!token) return null;
  return await Iron.seal(token, getEncryptionKey(), Iron.defaults);
}

async function decryptToken(sealed) {
  if (!sealed) return null;
  const result = await Iron.unseal(sealed, getEncryptionKey(), Iron.defaults);
  return result;
}

module.exports = {
  encryptToken,
  decryptToken,
};
