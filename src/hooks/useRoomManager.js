import { useState, useEffect } from 'react';
import QRCode from 'qrcode';

/**
 * Generates a cryptographically secure 6-character alphanumeric session key.
 * Uses crypto.getRandomValues() instead of Math.random().
 */
function generateSecureKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => chars[b % chars.length]).join('');
}

export function useRoomManager() {
  const [generatedKey, setGeneratedKey] = useState('');
  const [recentRooms, setRecentRooms] = useState([]);
  const [isGeneratingKey, setIsGeneratingKey] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [roomUrl, setRoomUrl] = useState('');
  const [showQRCode, setShowQRCode] = useState(false);

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem('recentRooms') || '[]');
    setRecentRooms(saved);
  }, []);

  const validateUsername = (name) => {
    if (!name || name.trim().length === 0) return 'Please enter a username';
    if (name.trim().length < 2) return 'Username must be at least 2 characters';
    if (name.trim().length > 20) return 'Username must be less than 20 characters';
    if (!/^[a-zA-Z0-9\s_-]+$/.test(name))
      return 'Username can only contain letters, numbers, spaces, underscores, and hyphens';
    return '';
  };

  const generateSessionKey = () => {
    setIsGeneratingKey(true);
    setTimeout(() => {
      setGeneratedKey(generateSecureKey());
      setIsGeneratingKey(false);
    }, 300);
  };

  const addToRecentRooms = (key) => {
    const updated = [key, ...recentRooms.filter(r => r !== key)].slice(0, 5);
    setRecentRooms(updated);
    localStorage.setItem('recentRooms', JSON.stringify(updated));
    return updated;
  };

  const clearRecentRooms = () => {
    setRecentRooms([]);
    localStorage.removeItem('recentRooms');
  };

  const generateQRCode = async (roomCode) => {
    try {
      const qrData = {
        type: 'PQEncrypt-room',
        roomKey: roomCode,
        url: `${window.location.origin}/room/${roomCode}`,
        timestamp: Date.now(),
      };
      const dataUrl = await QRCode.toDataURL(JSON.stringify(qrData));
      setQrCodeUrl(dataUrl);
      setRoomUrl(`${window.location.origin}/room/${roomCode}`);
    } catch (err) {
      console.error('QR generation failed:', err);
    }
  };

  const copyKeyToClipboard = () => {
    if (generatedKey) {
      navigator.clipboard.writeText(generatedKey);
      alert('Session key copied to clipboard!');
    }
  };

  const shareRoomUrl = () => {
    if (roomUrl) {
      navigator.clipboard.writeText(roomUrl);
      alert('Room URL copied to clipboard!');
    }
  };

  return {
    generatedKey,
    setGeneratedKey,
    recentRooms,
    isGeneratingKey,
    qrCodeUrl,
    roomUrl,
    showQRCode,
    setShowQRCode,
    validateUsername,
    generateSessionKey,
    addToRecentRooms,
    clearRecentRooms,
    generateQRCode,
    copyKeyToClipboard,
    shareRoomUrl,
  };
}
