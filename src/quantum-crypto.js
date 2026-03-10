// quantum-crypto.js
// Post-Quantum Cryptography — ML-KEM-1024 (encryption) + ML-DSA-87 (signing)
// Encryption: ML-KEM key exchange → AES-256-GCM  (replaces broken XOR)
// Signing:    ML-DSA over ciphertext              (integrity + authenticity)

import { ml_kem1024 } from '@noble/post-quantum/ml-kem.js';
import { ml_dsa87 }   from '@noble/post-quantum/ml-dsa.js';

const KEM = ml_kem1024;
const DSA = ml_dsa87;

// ─── Key Generation ──────────────────────────────────────────────────────────

export async function generateQuantumKeyPair() {
  console.log('🔐 Generating quantum-resistant key pair...');
  const kemKp = KEM.keygen();
  const dsaKp = DSA.keygen();
  const pair = {
    kemPublicKey:  kemKp.publicKey,
    kemPrivateKey: kemKp.secretKey,
    dsaPublicKey:  dsaKp.publicKey,
    dsaPrivateKey: dsaKp.secretKey,
    publicKey:  { kem: kemKp.publicKey,  dsa: dsaKp.publicKey  },
    privateKey: { kem: kemKp.secretKey,  dsa: dsaKp.secretKey  },
    algorithm:     'ML-KEM-1024 + ML-DSA-87',
    securityLevel: 'Post-Quantum Secure (NIST Level 5)',
    timestamp:     Date.now(),
  };
  console.log('✅ Quantum key pair generated  |  Algorithm:', pair.algorithm);
  return pair;
}

// ─── Key Export / Import ─────────────────────────────────────────────────────

export function exportQuantumPublicKey(publicKey) {
  const data = {
    kem: Array.from(publicKey.kem),
    dsa: Array.from(publicKey.dsa),
    algorithm: 'ML-KEM-1024 + ML-DSA-87',
    timestamp:  Date.now(),
  };
  return btoa(JSON.stringify(data));
}

export function importQuantumPublicKey(b64) {
  const data = JSON.parse(atob(b64));
  return { kem: new Uint8Array(data.kem), dsa: new Uint8Array(data.dsa) };
}

// ─── AES-256-GCM Helpers ─────────────────────────────────────────────────────

/**
 * Import an AES-256-GCM key from 32 raw bytes using browser WebCrypto.
 * The ML-KEM shared secret IS the AES key — no HKDF needed since the
 * KEM output is already uniformly random key material.
 */
async function importAesKey(sharedSecret, mode) {
  return crypto.subtle.importKey('raw', sharedSecret, { name: 'AES-GCM' }, false, [mode]);
}

// ─── Encrypt (ML-KEM + AES-256-GCM + ML-DSA sign) ───────────────────────────

/**
 * Encrypt a plaintext message for a single recipient.
 * @param {string}  message           Plaintext to encrypt
 * @param {object}  recipientPublicKey  { kem, dsa }
 * @param {object}  senderPrivateKey    { kem, dsa } — for ML-DSA signing
 * @returns Encrypted blob { kemCiphertext, iv, ciphertext, signature, algorithm }
 */
export async function encryptWithQuantum(message, recipientPublicKey, senderPrivateKey) {
  // 1. ML-KEM encapsulate → shared secret + kemCiphertext
  const { cipherText: kemCiphertext, sharedSecret } = KEM.encapsulate(recipientPublicKey.kem);

  // 2. AES-256-GCM encrypt
  const aesKey   = await importAesKey(sharedSecret, 'encrypt');
  const iv        = crypto.getRandomValues(new Uint8Array(12));
  const plainBytes = new TextEncoder().encode(message);
  const encBuf    = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, plainBytes);
  const ciphertext = new Uint8Array(encBuf);

  // 3. ML-DSA sign (kemCiphertext ‖ iv ‖ ciphertext) for integrity
  let signature = null;
  if (senderPrivateKey?.dsa) {
    const toSign = concat(kemCiphertext, iv, ciphertext);
    signature = Array.from(DSA.sign(toSign, senderPrivateKey.dsa));
  }

  return {
    kemCiphertext: Array.from(kemCiphertext),
    iv:            Array.from(iv),
    ciphertext:    Array.from(ciphertext),
    signature,
    algorithm: 'ML-KEM-1024 + AES-256-GCM + ML-DSA-87',
    timestamp:  Date.now(),
  };
}

// ─── Decrypt (ML-KEM + AES-256-GCM + ML-DSA verify) ─────────────────────────

/**
 * Decrypt an encrypted blob.
 * @param {object} encryptedData      Blob from encryptWithQuantum
 * @param {object} recipientPrivateKey  { kem, dsa }
 * @param {object} senderPublicKey      { kem, dsa } — for ML-DSA verification
 * @returns {string} Plaintext — throws if signature is invalid
 */
export async function decryptWithQuantum(encryptedData, recipientPrivateKey, senderPublicKey) {
  const kemCiphertext = new Uint8Array(encryptedData.kemCiphertext);
  const iv             = new Uint8Array(encryptedData.iv);
  const ciphertext     = new Uint8Array(encryptedData.ciphertext);

  // 1. ML-DSA verify signature before decrypting
  if (encryptedData.signature && senderPublicKey?.dsa) {
    const toVerify = concat(kemCiphertext, iv, ciphertext);
    const sig = new Uint8Array(encryptedData.signature);
    const valid = DSA.verify(toVerify, sig, senderPublicKey.dsa);
    if (!valid) throw new Error('⛔ ML-DSA signature verification failed — message rejected');
    console.log('✅ ML-DSA signature verified');
  }

  // 2. ML-KEM decapsulate → shared secret
  const sharedSecret = KEM.decapsulate(kemCiphertext, recipientPrivateKey.kem);

  // 3. AES-256-GCM decrypt
  const aesKey  = await importAesKey(sharedSecret, 'decrypt');
  const decBuf  = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, ciphertext);
  return new TextDecoder().decode(decBuf);
}

// ─── Stand-alone signing (for plain-text messages or file metadata) ───────────

export async function signWithQuantum(message, privateKey) {
  const bytes = new TextEncoder().encode(typeof message === 'string' ? message : JSON.stringify(message));
  const signature = DSA.sign(bytes, privateKey.dsa);
  return { message, signature: Array.from(signature), algorithm: 'ML-DSA-87', timestamp: Date.now() };
}

export async function verifyWithQuantum(signedData, publicKey) {
  try {
    const bytes = new TextEncoder().encode(
      typeof signedData.message === 'string' ? signedData.message : JSON.stringify(signedData.message)
    );
    const valid = DSA.verify(bytes, new Uint8Array(signedData.signature), publicKey.dsa);
    console.log(valid ? '✅ ML-DSA signature verified' : '❌ ML-DSA signature invalid');
    return valid;
  } catch { return false; }
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function concat(...arrays) {
  const total = arrays.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) { out.set(a, offset); offset += a.length; }
  return out;
}

export function generateQuantumSessionKey() {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function quantumHash(data) {
  const bytes = new TextEncoder().encode(data);
  const buf   = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function getQuantumSecurityInfo() {
  return {
    currentAlgorithm: 'ML-KEM-1024 + AES-256-GCM + ML-DSA-87',
    encryption:       'ML-KEM-1024 key exchange → AES-256-GCM authenticated encryption',
    signing:          'ML-DSA-87 over (kemCiphertext ‖ iv ‖ ciphertext)',
    nistSecurityLevel: 5,
    quantumResistance: 'Full resistance to quantum attacks',
    keySize: {
      kem: '1568 bytes (public), 3168 bytes (private)',
      dsa: '2592 bytes (public), 4896 bytes (private)',
    },
  };
}

// ─── Legacy aliases ───────────────────────────────────────────────────────────

export async function generateKeyPair()                           { return generateQuantumKeyPair(); }
export function  exportPublicKey(pk)                              { return exportQuantumPublicKey(pk); }
export function  importPublicKey(s)                               { return importQuantumPublicKey(s); }
export async function encryptMessage(publicKey, message, signingKey) { return encryptWithQuantum(message, publicKey, signingKey); }
export async function decryptMessage(privateKey, data, senderPub)   { return decryptWithQuantum(data, privateKey, senderPub); }
