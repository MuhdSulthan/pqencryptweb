import { useState, useRef, useEffect } from 'react';
import io from 'socket.io-client';
import { ml_dsa87 } from '@noble/post-quantum/ml-dsa.js';

const SERVER_URL = 'https://maxyserver.servehalflife.com';

export function useSocket({ keys, exportPublicKey, importPublicKey }) {
  const [socket, setSocket]               = useState(null);
  const [userId, setUserId]               = useState(null);
  const [messages, setMessages]           = useState([]);
  const [roomUsers, setRoomUsers]         = useState([]);
  const [userPublicKeys, setUserPublicKeys] = useState({});
  const [roomLocked, setRoomLocked]       = useState(false);
  const [isRoomCreator, setIsRoomCreator] = useState(false);

  const socketRef         = useRef(null);
  const roomKeyRef        = useRef('');
  // Stable refs for use inside socket handlers (avoid stale closures)
  const keysRef           = useRef(null);
  const userIdRef         = useRef(null);
  const userPublicKeysRef = useRef({});

  // Keep refs in sync with state
  useEffect(() => { keysRef.current           = keys; },           [keys]);
  useEffect(() => { userIdRef.current         = userId; },         [userId]);
  useEffect(() => { userPublicKeysRef.current = userPublicKeys; }, [userPublicKeys]);

  // ── AES-GCM helpers for the plain-message pathway ──────────────────────
  // Derives a 256-bit AES key from the roomKey using SHA-256.
  // This means even "plain" fallback messages are encrypted —
  // the server only ever sees ciphertext.
  const deriveRoomAesKey = async (roomKey) => {
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(roomKey));
    return crypto.subtle.importKey('raw', hash, 'AES-GCM', false, ['encrypt', 'decrypt']);
  };

  const encryptPlain = async (text, roomKey) => {
    const key = await deriveRoomAesKey(roomKey);
    const iv  = crypto.getRandomValues(new Uint8Array(12));
    const buf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(text));
    const toB64 = (u8) => btoa(String.fromCharCode(...u8));
    return { ciphertext: toB64(new Uint8Array(buf)), iv: toB64(iv) };
  };

  const decryptPlain = async (ciphertext, iv, roomKey) => {
    const key   = await deriveRoomAesKey(roomKey);
    const fromB64 = (s) => Uint8Array.from(atob(s), c => c.charCodeAt(0));
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromB64(iv) }, key, fromB64(ciphertext)
    );
    return new TextDecoder().decode(plain);
  };

  const joinRoom = ({
    key, name, isCreator,
    decryptMessage,
    onRoomLocked,   // called when this client is REJECTED from a locked room
    onIncomingCall, onCallOffer, onCallAnswer, onIceCandidate, onCallEnded,
  }) => {
    roomKeyRef.current = key;
    setIsRoomCreator(isCreator);

    // Track whether we successfully joined — helps distinguish
    // lock-rejection from an in-room lock broadcast.
    let hasJoined = false;

    const newSocket = io(SERVER_URL, { transports: ['polling', 'websocket'], reconnection: true });
    socketRef.current = newSocket;

    newSocket.on('connect', () => {
      console.log('✅ Connected. Socket ID:', newSocket.id);
      newSocket.emit('join room', { roomKey: key, username: name });
    });

    newSocket.on('room joined', (data) => {
      hasJoined = true;
      setMessages(data.messages || []);
    });

    newSocket.on('user connected', (data) => {
      setUserId(data.userId);
      userIdRef.current = data.userId;
      const k = keysRef.current;
      if (k) {
        const pem = exportPublicKey(k.publicKey);
        newSocket.emit('share public key', { roomKey: key, publicKey: pem });
      }
    });

    newSocket.on('room locked', () => {
      if (!hasJoined) {
        // We were rejected before ever joining — navigate back with an error
        newSocket.disconnect();
        onRoomLocked?.();
        return;
      }
      setRoomLocked(true);
    });
    newSocket.on('room unlocked', () => setRoomLocked(false));
    newSocket.on('system message',     (msg) => setMessages(prev => [...prev, msg]));
    newSocket.on('chat message plain', async (msg) => {
      // Drop echo of our own PLAIN TEXT messages only.
      // File messages are NOT pre-added via addOwnMessage, so the server echo
      // is the only way the sender sees the file — do NOT dedup those.
      const isOwnPlainText = msg.from && msg.from === userIdRef.current && (!msg.type || msg.type === 'text');
      if (isOwnPlainText) return;

      // Verify ML-DSA-87 signature before showing the message
      const senderPubKey = userPublicKeysRef.current[msg.from]?.dsa;
      if (msg.signature && senderPubKey) {
        try {
          const payload = new TextEncoder().encode(msg.ciphertext + msg.iv);
          const valid   = ml_dsa87.verify(senderPubKey, payload, new Uint8Array(msg.signature));
          if (!valid) {
            console.error('⛔ ML-DSA signature INVALID on plain message — discarded');
            return; // reject tampered message
          }
          console.log('✅ ML-DSA signature verified on plain message');
        } catch (e) {
          console.warn('Signature check error:', e);
        }
      }

      // Decrypt the AES-GCM ciphertext before displaying
      try {
        const text = await decryptPlain(msg.ciphertext, msg.iv, roomKeyRef.current);
        setMessages(prev => [...prev, { ...msg, text }]);
      } catch {
        // Fallback: if decryption fails (e.g. legacy message), show raw
        setMessages(prev => [...prev, msg]);
      }
    });

    // Encrypted messages — decrypt before storing
    newSocket.on('chat message', async (msg) => {
      const myKeys  = keysRef.current;
      const myId    = userIdRef.current;
      const pubKeys = userPublicKeysRef.current;

      // The server echoes our own send back to us. We already stored the
      // plaintext via addOwnMessage — drop the echo to avoid the duplicate
      // [encrypted] bubble (our own ID is excluded from msg.encrypted).
      if (msg.from === myId) return;

      if (myKeys && myId && msg.encrypted?.[myId]) {
        try {
          const senderPub = pubKeys[msg.from] || null;
          const plaintext = await decryptMessage(myKeys.privateKey, msg.encrypted[myId], senderPub);
          setMessages(prev => [...prev, { ...msg, text: plaintext, decrypted: true }]);
          return;
        } catch (err) {
          console.error('❌ Decryption failed:', err.message);
        }
      }
      // Decryption unavailable or failed
      setMessages(prev => [...prev, { ...msg, text: msg.text || '[encrypted]', decrypted: false }]);
    });


    newSocket.on('new user', ({ userId: uid, publicKey, username }) => {
      try {
        const imported = importPublicKey(publicKey);
        setUserPublicKeys(prev => ({ ...prev, [uid]: imported }));
      } catch (e) { console.error('import public key error', e); }
    });

    newSocket.on('existing users', (users) => {
      const imported = {};
      for (const [uid, userData] of Object.entries(users)) {
        if (userData.publicKey) {
          try { imported[uid] = importPublicKey(userData.publicKey); }
          catch (e) { console.error('import public key error for', uid, e); }
        }
      }
      setUserPublicKeys(imported);
    });

    newSocket.on('room users', (users) => setRoomUsers(users));

    // WebRTC signaling
    newSocket.on('incoming-call', onIncomingCall);
    newSocket.on('call-offer',    onCallOffer);
    newSocket.on('call-answer',   onCallAnswer);
    newSocket.on('ice-candidate', onIceCandidate);
    newSocket.on('call-ended',    onCallEnded);

    setSocket(newSocket);
  };

  const leaveRoom = () => {
    socketRef.current?.emit('leave room');
    socketRef.current?.disconnect();
    socketRef.current = null;
    setSocket(null);
    setMessages([]);
    setUserPublicKeys({});
    setUserId(null);
    setRoomUsers([]);
    setRoomLocked(false);
    setIsRoomCreator(false);
  };

  /**
   * Send a message — encrypts per-recipient with ML-KEM + AES-GCM + ML-DSA.
   * Only the kemCiphertext/iv/ciphertext/signature are sent — never the plaintext.
   */
  const sendMessage = async ({ message, userId: uid, username, keys: k, userPublicKeys: upk, encryptMessage }) => {
    if (!message.trim() || !uid || !socketRef.current) return false;

    if (k && upk && Object.keys(upk).length > 0) {
      try {
        // Encrypt per-recipient — do NOT include a plaintext 'text' field
        const encryptedPerUser = {};
        await Promise.all(
          Object.keys(upk)
            .filter(targetId => targetId !== uid)
            .map(async targetId => {
              encryptedPerUser[targetId] = await encryptMessage(upk[targetId], message, k.privateKey);
            })
        );

        socketRef.current.emit('chat message', {
          // No 'text' field — plaintext must never travel alongside ciphertext
          encrypted: encryptedPerUser,
          from:      uid,
          username,
          timestamp: Date.now(),
        });
      } catch (err) {
        console.error('Encryption failed, falling back to AES plain:', err);
        // Still encrypt with room-key AES even in fallback
        try {
          const { ciphertext, iv } = await encryptPlain(message, roomKeyRef.current);
          socketRef.current.emit('chat message plain', { ciphertext, iv, from: uid, username, timestamp: Date.now() });
        } catch {
          socketRef.current.emit('chat message plain', { text: message, from: uid, username, timestamp: Date.now() });
        }
      }
    } else {
      // No keys yet — encrypt text with room-key-derived AES before sending
      // so the server only ever sees ciphertext, never the user's message.
      try {
        const { ciphertext, iv } = await encryptPlain(message, roomKeyRef.current);

        // ML-DSA-87 sign (ciphertext ‖ iv) so receiver can verify integrity
        let signature = null;
        if (k?.privateKey?.dsa) {
          const payload = new TextEncoder().encode(ciphertext + iv);
          signature = Array.from(ml_dsa87.sign(k.privateKey.dsa, payload));
        }

        socketRef.current.emit('chat message plain', { ciphertext, iv, signature, from: uid, username, timestamp: Date.now() });
      } catch {
        // Last-resort fallback — should never happen in browsers with SubtleCrypto
        socketRef.current.emit('chat message plain', { text: message, from: uid, username, timestamp: Date.now() });
      }
    }
    return true;
  };

  // Store own sent messages in local state immediately
  const addOwnMessage = (message, uid, username) => {
    setMessages(prev => [...prev, {
      text: message, from: uid, username, timestamp: Date.now(), isOwn: true, decrypted: true,
    }]);
  };

  const sendCallNotification = (text) => {
    socketRef.current?.emit('chat message plain', {
      text, type: 'call-notification', timestamp: new Date().toISOString(),
    });
  };

  const lockRoom   = (key) => socketRef.current?.emit('lock room',   { roomKey: key });
  const unlockRoom = (key) => socketRef.current?.emit('unlock room', { roomKey: key });
  const emitWebRTC = (event, data) => socketRef.current?.emit(event, data);

  return {
    socket, socketRef, roomKeyRef,
    userId, messages, roomUsers, userPublicKeys,
    roomLocked, isRoomCreator,
    joinRoom, leaveRoom, sendMessage, addOwnMessage,
    sendCallNotification, lockRoom, unlockRoom, emitWebRTC,
  };
}
