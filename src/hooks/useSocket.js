import { useState, useRef } from 'react';
import io from 'socket.io-client';

const SERVER_URL = 'https://maxyserver.servehalflife.com';

export function useSocket({ keys, exportPublicKey, importPublicKey }) {
  const [socket, setSocket] = useState(null);
  const [userId, setUserId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [roomUsers, setRoomUsers] = useState([]);
  const [userPublicKeys, setUserPublicKeys] = useState({});
  const [roomLocked, setRoomLocked] = useState(false);
  const [isRoomCreator, setIsRoomCreator] = useState(false);

  // Expose a ref so WebRTC hook can read current socket and roomKey
  const socketRef = useRef(null);
  const roomKeyRef = useRef('');

  const joinRoom = ({
    key,
    name,
    isCreator,
    onIncomingCall,
    onCallOffer,
    onCallAnswer,
    onIceCandidate,
    onCallEnded,
  }) => {
    roomKeyRef.current = key;
    setIsRoomCreator(isCreator);

    const newSocket = io(SERVER_URL, {
      transports: ['polling', 'websocket'],
      reconnection: true,
    });

    socketRef.current = newSocket;

    newSocket.on('connect', () => {
      console.log('✅ Connected. Socket ID:', newSocket.id);
      newSocket.emit('join room', { roomKey: key, username: name });
    });

    newSocket.on('room joined', (data) => {
      setMessages(data.messages || []);
    });

    newSocket.on('user connected', (data) => {
      setUserId(data.userId);
      if (keys) {
        const publicKeyPem = exportPublicKey(keys.publicKey);
        newSocket.emit('share public key', { roomKey: key, publicKey: publicKeyPem });
      }
    });

    newSocket.on('room locked', () => setRoomLocked(true));
    newSocket.on('room unlocked', () => setRoomLocked(false));

    newSocket.on('system message', (msg) => setMessages(prev => [...prev, msg]));
    newSocket.on('chat message', (msg) => setMessages(prev => [...prev, msg]));
    newSocket.on('chat message plain', (msg) => setMessages(prev => [...prev, msg]));

    newSocket.on('new user', ({ userId: uid, publicKey, username }) => {
      const imported = importPublicKey(publicKey);
      setUserPublicKeys(prev => ({ ...prev, [uid]: imported }));
    });

    newSocket.on('existing users', (users) => {
      const imported = {};
      for (const [uid, userData] of Object.entries(users)) {
        if (userData.publicKey) {
          imported[uid] = importPublicKey(userData.publicKey);
        }
      }
      setUserPublicKeys(imported);
    });

    newSocket.on('room users', (users) => {
      setRoomUsers(users);
    });

    // WebRTC signaling — delegated to callbacks from useWebRTC
    newSocket.on('incoming-call', onIncomingCall);
    newSocket.on('call-offer', onCallOffer);
    newSocket.on('call-answer', onCallAnswer);
    newSocket.on('ice-candidate', onIceCandidate);
    newSocket.on('call-ended', onCallEnded);

    setSocket(newSocket);
  };

  const leaveRoom = () => {
    if (socketRef.current) {
      socketRef.current.emit('leave room');
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setSocket(null);
    setMessages([]);
    setUserPublicKeys({});
    setUserId(null);
    setRoomUsers([]);
    setRoomLocked(false);
    setIsRoomCreator(false);
  };

  const sendMessage = ({ message, userId: uid, username, keys: k, userPublicKeys: upk, encryptMessage }) => {
    if (!message.trim() || !uid || !socketRef.current) return false;

    if (k && upk && Object.keys(upk).length > 0) {
      try {
        const encryptedMessages = {};
        Object.keys(upk).forEach(targetId => {
          if (targetId !== uid) {
            encryptedMessages[targetId] = encryptMessage(upk[targetId], message);
          }
        });
        socketRef.current.emit('chat message', {
          text: message,
          encrypted: encryptedMessages,
          from: uid,
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

  const sendCallNotification = (text) => {
    if (socketRef.current) {
      socketRef.current.emit('chat message plain', {
        text,
        type: 'call-notification',
        timestamp: new Date().toISOString(),
      });
    }
  };

  const lockRoom = (key) => socketRef.current?.emit('lock room', { roomKey: key });
  const unlockRoom = (key) => socketRef.current?.emit('unlock room', { roomKey: key });
  const emitWebRTC = (event, data) => socketRef.current?.emit(event, data);

  return {
    socket,
    socketRef,
    roomKeyRef,
    userId,
    messages,
    roomUsers,
    userPublicKeys,
    roomLocked,
    isRoomCreator,
    joinRoom,
    leaveRoom,
    sendMessage,
    sendCallNotification,
    lockRoom,
    unlockRoom,
    emitWebRTC,
  };
}
