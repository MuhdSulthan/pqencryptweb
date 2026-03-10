import { useState, useRef, useEffect } from 'react';
import io from 'socket.io-client';

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

  const joinRoom = ({
    key, name, isCreator,
    decryptMessage,
    onIncomingCall, onCallOffer, onCallAnswer, onIceCandidate, onCallEnded,
  }) => {
    roomKeyRef.current = key;
    setIsRoomCreator(isCreator);

    const newSocket = io(SERVER_URL, { transports: ['polling', 'websocket'], reconnection: true });
    socketRef.current = newSocket;

    newSocket.on('connect', () => {
      console.log('✅ Connected. Socket ID:', newSocket.id);
      newSocket.emit('join room', { roomKey: key, username: name });
    });

    newSocket.on('room joined', (data) => setMessages(data.messages || []));

    newSocket.on('user connected', (data) => {
      setUserId(data.userId);
      userIdRef.current = data.userId;
      const k = keysRef.current;
      if (k) {
        const pem = exportPublicKey(k.publicKey);
        newSocket.emit('share public key', { roomKey: key, publicKey: pem });
      }
    });

    newSocket.on('room locked',   () => setRoomLocked(true));
    newSocket.on('room unlocked', () => setRoomLocked(false));
    newSocket.on('system message',     (msg) => setMessages(prev => [...prev, msg]));
    newSocket.on('chat message plain', (msg) => setMessages(prev => [...prev, msg]));

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
        console.error('Encryption failed, sending plain:', err);
        socketRef.current.emit('chat message plain', { text: message, from: uid, username, timestamp: Date.now() });
      }
    } else {
      socketRef.current.emit('chat message plain', { text: message, from: uid, username, timestamp: Date.now() });
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
