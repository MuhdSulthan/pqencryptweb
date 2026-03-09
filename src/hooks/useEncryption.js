import { useState, useEffect } from 'react';
import {
  generateKeyPair,
  exportPublicKey,
  importPublicKey,
  encryptMessage,
  decryptMessage,
  getQuantumSecurityInfo,
} from '../quantum-crypto';

export function useEncryption() {
  const [keys, setKeys] = useState(null);
  const [quantumSecurity, setQuantumSecurity] = useState(null);

  useEffect(() => {
    const init = async () => {
      try {
        console.log('🔐 Generating quantum-resistant keys...');
        const keyPair = await generateKeyPair();
        console.log('✅ Quantum keys generated');
        setKeys(keyPair);
        setQuantumSecurity(getQuantumSecurityInfo());
      } catch (err) {
        console.error('❌ Key generation failed:', err);
        alert('Error generating quantum encryption keys. Please refresh the page.');
      }
    };
    init();
  }, []);

  return {
    keys,
    quantumSecurity,
    exportPublicKey,
    importPublicKey,
    encryptMessage,
    decryptMessage,
  };
}
