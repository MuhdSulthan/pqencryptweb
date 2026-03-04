import forge from 'node-forge';

// Generate a new RSA key pair
export const generateKeyPair = () => {
  return new Promise((resolve, reject) => {
    forge.pki.rsa.generateKeyPair({ bits: 2048, workers: -1 }, (err, keypair) => {
      if (err) {
        return reject(err);
      }
      resolve(keypair);
    });
  });
};

// Export public key to PEM format
export const exportPublicKey = (publicKey) => {
  return forge.pki.publicKeyToPem(publicKey);
};

// Import public key from PEM format
export const importPublicKey = (publicKeyPem) => {
  return forge.pki.publicKeyFromPem(publicKeyPem);
};

// Encrypt a message with a public key
export const encryptMessage = (publicKey, message) => {
  const encrypted = publicKey.encrypt(message, 'RSA-OAEP', {
    md: forge.md.sha256.create(),
  });
  return forge.util.encode64(encrypted);
};

// Decrypt a message with a private key
export const decryptMessage = (privateKey, encryptedMessage) => {
  const decoded = forge.util.decode64(encryptedMessage);
  try {
    const decrypted = privateKey.decrypt(decoded, 'RSA-OAEP', {
      md: forge.md.sha256.create(),
    });
    return decrypted;
  } catch (e) {
    console.error('Decryption failed:', e);
    return 'Failed to decrypt message.';
  }
};
