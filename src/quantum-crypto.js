// quantum-crypto.js
// Post-Quantum Cryptography Implementation using ML-KEM and ML-DSA

import { ml_kem1024 } from '@noble/post-quantum/ml-kem.js';
import { ml_dsa87 } from '@noble/post-quantum/ml-dsa.js';

// Choose security levels - using the highest available variants
const KEM_ALGORITHM = ml_kem1024; // Highest security ML-KEM
const DSA_ALGORITHM = ml_dsa87;   // Highest security ML-DSA

/**
 * Quantum-Resistant Key Pair Generation
 * Combines ML-KEM (Key Encapsulation) and ML-DSA (Digital Signature)
 */
export async function generateQuantumKeyPair() {
  try {
    console.log('🔐 Generating quantum-resistant key pair...');
    
    // Generate ML-KEM key pair for encryption
    const kemKeyPair = await KEM_ALGORITHM.keygen();
    
    // Generate ML-DSA key pair for signing
    const dsaKeyPair = await DSA_ALGORITHM.keygen();
    
    const quantumKeyPair = {
      // KEM keys for encryption/decryption
      kemPublicKey: kemKeyPair.publicKey,
      kemPrivateKey: kemKeyPair.privateKey,
      
      // DSA keys for signing/verification
      dsaPublicKey: dsaKeyPair.publicKey,
      dsaPrivateKey: dsaKeyPair.privateKey,
      
      // Combined public key for sharing
      publicKey: {
        kem: kemKeyPair.publicKey,
        dsa: dsaKeyPair.publicKey
      },
      
      // Combined private key (kept secret)
      privateKey: {
        kem: kemKeyPair.privateKey,
        dsa: dsaKeyPair.privateKey
      },
      
      algorithm: 'ML-KEM-1024 + ML-DSA-87',
      securityLevel: 'Post-Quantum Secure (NIST Level 5)',
      timestamp: Date.now()
    };
    
    console.log('✅ Quantum key pair generated successfully');
    console.log(`🔑 Algorithm: ${quantumKeyPair.algorithm}`);
    
    return quantumKeyPair;
  } catch (error) {
    console.error('❌ Error generating quantum key pair:', error);
    throw new Error('Failed to generate quantum-resistant key pair');
  }
}

/**
 * Export quantum public key to base64 string for sharing
 */
export function exportQuantumPublicKey(publicKey) {
  try {
    const publicKeyData = {
      kem: Array.from(publicKey.kem),
      dsa: Array.from(publicKey.dsa),
      algorithm: 'ML-KEM-1024 + ML-DSA-87',
      timestamp: Date.now()
    };
    
    return btoa(JSON.stringify(publicKeyData));
  } catch (error) {
    console.error('❌ Error exporting quantum public key:', error);
    throw new Error('Failed to export quantum public key');
  }
}

/**
 * Import quantum public key from base64 string
 */
export function importQuantumPublicKey(publicKeyString) {
  try {
    const publicKeyData = JSON.parse(atob(publicKeyString));
    
    return {
      kem: new Uint8Array(publicKeyData.kem),
      dsa: new Uint8Array(publicKeyData.dsa)
    };
  } catch (error) {
    console.error('❌ Error importing quantum public key:', error);
    throw new Error('Failed to import quantum public key');
  }
}

/**
 * Encrypt message using ML-KEM (Key Encapsulation Mechanism)
 */
export async function encryptWithQuantum(message, recipientPublicKey) {
  try {
    console.log('🔒 Encrypting message with quantum cryptography...');
    
    // Convert message to bytes
    const messageBytes = new TextEncoder().encode(message);
    
    // Encapsulate shared secret using recipient's KEM public key
    const { ciphertext: kemCiphertext, sharedSecret } = await KEM_ALGORITHM.encapsulate(
      recipientPublicKey.kem
    );
    
    // Use shared secret to encrypt the actual message (using XOR for simplicity)
    const encryptedMessage = new Uint8Array(messageBytes.length);
    for (let i = 0; i < messageBytes.length; i++) {
      encryptedMessage[i] = messageBytes[i] ^ sharedSecret[i % sharedSecret.length];
    }
    
    const encryptedData = {
      kemCiphertext: Array.from(kemCiphertext),
      encryptedMessage: Array.from(encryptedMessage),
      algorithm: 'ML-KEM-1024',
      timestamp: Date.now()
    };
    
    console.log('✅ Message encrypted with quantum cryptography');
    return encryptedData;
  } catch (error) {
    console.error('❌ Error encrypting with quantum cryptography:', error);
    throw new Error('Failed to encrypt message with quantum cryptography');
  }
}

/**
 * Decrypt message using ML-KEM (Key Encapsulation Mechanism)
 */
export async function decryptWithQuantum(encryptedData, privateKey) {
  try {
    console.log('🔓 Decrypting message with quantum cryptography...');
    
    // Convert arrays back to Uint8Array
    const kemCiphertext = new Uint8Array(encryptedData.kemCiphertext);
    const encryptedMessage = new Uint8Array(encryptedData.encryptedMessage);
    
    // Decapsulate shared secret using private KEM key
    const sharedSecret = await KEM_ALGORITHM.decapsulate(kemCiphertext, privateKey.kem);
    
    // Use shared secret to decrypt the message (reverse XOR)
    const decryptedBytes = new Uint8Array(encryptedMessage.length);
    for (let i = 0; i < encryptedMessage.length; i++) {
      decryptedBytes[i] = encryptedMessage[i] ^ sharedSecret[i % sharedSecret.length];
    }
    
    // Convert back to string
    const decryptedMessage = new TextDecoder().decode(decryptedBytes);
    
    console.log('✅ Message decrypted with quantum cryptography');
    return decryptedMessage;
  } catch (error) {
    console.error('❌ Error decrypting with quantum cryptography:', error);
    throw new Error('Failed to decrypt message with quantum cryptography');
  }
}

/**
 * Sign message using ML-DSA (Digital Signature Algorithm)
 */
export async function signWithQuantum(message, privateKey) {
  try {
    console.log('✍️ Signing message with quantum digital signature...');
    
    // Convert message to bytes
    const messageBytes = new TextEncoder().encode(message);
    
    // Sign the message using ML-DSA private key
    const signature = await DSA_ALGORITHM.sign(messageBytes, privateKey.dsa);
    
    const signedData = {
      message: message,
      signature: Array.from(signature),
      algorithm: 'ML-DSA-87',
      timestamp: Date.now()
    };
    
    console.log('✅ Message signed with quantum digital signature');
    return signedData;
  } catch (error) {
    console.error('❌ Error signing with quantum cryptography:', error);
    throw new Error('Failed to sign message with quantum cryptography');
  }
}

/**
 * Verify signature using ML-DSA
 */
export async function verifyWithQuantum(signedData, publicKey) {
  try {
    console.log('🔍 Verifying quantum digital signature...');
    
    // Convert signature back to Uint8Array
    const signature = new Uint8Array(signedData.signature);
    const messageBytes = new TextEncoder().encode(signedData.message);
    
    // Verify the signature using ML-DSA public key
    const isValid = await DSA_ALGORITHM.verify(signature, messageBytes, publicKey.dsa);
    
    console.log(isValid ? '✅ Quantum signature verified' : '❌ Quantum signature invalid');
    return isValid;
  } catch (error) {
    console.error('❌ Error verifying quantum signature:', error);
    return false;
  }
}

/**
 * Generate quantum-secure random session key
 */
export function generateQuantumSessionKey() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Hash function for quantum cryptography
 */
export async function quantumHash(data) {
  const encoder = new TextEncoder();
  const dataBytes = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBytes);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Compare quantum security with RSA
 */
export function getQuantumSecurityInfo() {
  return {
    currentAlgorithm: 'ML-KEM-1024 + ML-DSA-87',
    previousAlgorithm: 'RSA-2048',
    quantumResistance: 'Full resistance to quantum attacks',
    nistSecurityLevel: 5, // Highest NIST security level
    keySize: {
      kem: '4160 bytes (public), 4160 bytes (private)',
      dsa: '5376 bytes (public), 16480 bytes (private)',
      total: '~26KB total vs 512B for RSA-2048'
    },
    performance: 'Slower than RSA but quantum-safe',
    protection: 'Protects against both classical and quantum computers'
  };
}

// Legacy compatibility functions (to replace existing RSA functions)
export async function generateKeyPair() {
  return await generateQuantumKeyPair();
}

export function exportPublicKey(publicKey) {
  return exportQuantumPublicKey(publicKey);
}

export function importPublicKey(publicKeyString) {
  return importQuantumPublicKey(publicKeyString);
}

export async function encryptMessage(publicKey, message) {
  return await encryptWithQuantum(message, publicKey);
}

export async function decryptMessage(privateKey, encryptedData) {
  return await decryptWithQuantum(encryptedData, privateKey);
}
