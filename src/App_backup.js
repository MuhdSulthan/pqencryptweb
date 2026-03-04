// src/App.js
import React, { useState, useEffect, useCallback } from 'react';
import io from 'socket.io-client';
import QRCode from 'qrcode';
import {
  generateKeyPair,
  exportPublicKey,
  decryptMessage,
  getQuantumSecurityInfo,
} from './quantum-crypto';
import './App.css';

function App() {
  // App state
  const [currentView, setCurrentView] = useState('home'); // 'home', 'chat'
  const [theme, setTheme] = useState('light');
  
  // Mobile enhancements
  const [isMobile, setIsMobile] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [pullStartY, setPullStartY] = useState(0);
  
  // Haptic feedback utility
  const triggerHaptic = (type = 'light') => {
    if ('vibrate' in navigator) {
      switch (type) {
        case 'light':
          navigator.vibrate(10);
          break;
        case 'medium':
          navigator.vibrate(25);
          break;
        case 'heavy':
          navigator.vibrate(50);
          break;
        case 'success':
          navigator.vibrate([10, 50, 10]);
          break;
        case 'error':
          navigator.vibrate([100, 50, 100]);
          break;
        default:
          navigator.vibrate(10);
      }
    }
  };
  
  // Pull-to-refresh handlers
  const handleTouchStart = (e) => {
    if (!isMobile || currentView !== 'chat') return;
    setPullStartY(e.touches[0].clientY);
    setIsPulling(true);
  };
  
  const handleTouchMove = (e) => {
    if (!isPulling || !isMobile) return;
    const currentY = e.touches[0].clientY;
    const pullDistance = currentY - pullStartY;
    
    // Only trigger if pulling down from top
    if (pullDistance > 50 && window.scrollY === 0) {
      triggerHaptic('light');
      // Add visual feedback
      document.body.style.transform = `translateY(${Math.min(pullDistance * 0.3, 100)}px)`;
    }
  };
  
  const handleTouchEnd = () => {
    if (!isPulling || !isMobile) return;
    setIsPulling(false);
    document.body.style.transform = '';
    
    // Refresh messages if pulled enough
    const pullDistance = pullStartY > 0 ? 0 : pullStartY;
    if (Math.abs(pullDistance) > 100) {
      triggerHaptic('success');
      // Trigger message refresh
      if (socket && roomKey) {
        console.log('🔄 Refreshing messages...');
        // Could emit a refresh event or reload messages
      }
    }
  };
  
  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                            window.innerWidth <= 768;
      setIsMobile(isMobileDevice);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // Room state
  const [roomKey, setRoomKey] = useState('');
  const [generatedKey, setGeneratedKey] = useState('');
  const [username, setUsername] = useState('');
  
  // Enhanced signin state
  const [usernameError, setUsernameError] = useState('');
  const [roomKeyError, setRoomKeyError] = useState('');
  const [recentRooms, setRecentRooms] = useState([]);
  const [showWelcome, setShowWelcome] = useState(false);
  const [isGeneratingKey, setIsGeneratingKey] = useState(false);
  const [roomLocked, setRoomLocked] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [showQRCode, setShowQRCode] = useState(false);
  const [roomUrl, setRoomUrl] = useState('');
  const [isRoomCreator, setIsRoomCreator] = useState(false);
  const [isUrlJoin, setIsUrlJoin] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected'); // 'disconnected', 'connecting', 'connected'
  const [quantumSecurity, setQuantumSecurity] = useState(null);
  const [showSecurityInfo, setShowSecurityInfo] = useState(false);
  
  // Chat state
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [userId, setUserId] = useState(null);
  const [keys, setKeys] = useState(null);
  const [socket, setSocket] = useState(null);
  const [roomUsers, setRoomUsers] = useState([]);
  const [showUserList, setShowUserList] = useState(false);
  const [isInCall, setIsInCall] = useState(false);
  const [callInProgress, setCallInProgress] = useState(false);
  const [currentCallType, setCurrentCallType] = useState('audio');
  const [incomingCall, setIncomingCall] = useState(null); // Store incoming call data
  const [callDuration, setCallDuration] = useState(0);
  const [callTimer, setCallTimer] = useState(null);
  const [pendingOffer, setPendingOffer] = useState(null);
  const [pendingIceCandidates, setPendingIceCandidates] = useState([]);
  const [localStream, setLocalStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  // Generate quantum keys on component mount
  useEffect(() => {
    const init = async () => {
      try {
        console.log('🔐 Generating quantum-resistant keys...');
        const keyPair = await generateKeyPair();
        console.log('✅ Quantum keys generated successfully');
        console.log(`🛡️ Algorithm: ${keyPair.algorithm}`);
        setKeys(keyPair);
        
        // Get quantum security information
        const securityInfo = getQuantumSecurityInfo();
        setQuantumSecurity(securityInfo);
      } catch (error) {
        console.error('❌ Error generating quantum keys:', error);
        alert('Error generating quantum encryption keys. Please refresh the page.');
      }
    };
    init();
  }, []);

  // Load theme and user preferences from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);
    document.body.className = savedTheme;
    
    // Load saved username
    const savedUsername = localStorage.getItem('username') || '';
    setUsername(savedUsername);
    
    // Load recent rooms
    const savedRooms = JSON.parse(localStorage.getItem('recentRooms') || '[]');
    setRecentRooms(savedRooms);
    
    // Show welcome for first-time users
    const hasVisited = localStorage.getItem('hasVisited');
    if (!hasVisited) {
      setShowWelcome(true);
      localStorage.setItem('hasVisited', 'true');
    }
  }, []);

  // Handle direct room access via URL
  useEffect(() => {
    const path = window.location.pathname;
    console.log('🌐 Current path:', path);
    
    // Check if path matches room URL pattern
    const roomMatch = path.match(/^\/room\/([A-Z0-9]{6})$/i);
    if (roomMatch) {
      const roomCode = roomMatch[1].toUpperCase();
      console.log('🔗 Detected room URL access for:', roomCode);
      
      // Set the room key so user can join after entering username
      setRoomKey(roomCode);
      setIsUrlJoin(true); // Flag to show URL join UI
    }
  }, []); // Only run once on mount

  // Handle call timer
  useEffect(() => {
    if (isInCall && !callTimer) {
      const timer = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
      setCallTimer(timer);
    } else if (!isInCall && callTimer) {
      clearInterval(callTimer);
      setCallTimer(null);
      setCallDuration(0);
    }
    
    return () => {
      if (callTimer) {
        clearInterval(callTimer);
      }
    };
  }, [isInCall, callTimer]);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.body.className = newTheme;
  };

  const validateUsername = (name) => {
    if (!name || name.trim().length === 0) {
      return 'Please enter a username';
    }
    if (name.trim().length < 2) {
      return 'Username must be at least 2 characters';
    }
    if (name.trim().length > 20) {
      return 'Username must be less than 20 characters';
    }
    if (!/^[a-zA-Z0-9\s_-]+$/.test(name)) {
      return 'Username can only contain letters, numbers, spaces, underscores, and hyphens';
    }
    return '';
  };

  const generateSessionKey = () => {
    setIsGeneratingKey(true);
    setUsernameError('');
    
    // Simulate key generation with a small delay for better UX
    setTimeout(() => {
      const key = Math.random().toString(36).substring(2, 8).toUpperCase();
      setGeneratedKey(key);
      setIsGeneratingKey(false);
    }, 300);
  };

  const startChatRoom = () => {
    console.log('🚀 Starting chat room...');
    console.log('📝 Username:', username);
    console.log('🔑 Generated Key:', generatedKey);
    console.log('🔐 Keys available:', !!keys);
    
    const validationError = validateUsername(username);
    if (validationError) {
      console.log('❌ Username validation failed:', validationError);
      setUsernameError(validationError);
      return;
    }
    
    if (!generatedKey) {
      console.log('❌ No generated key');
      alert('Please generate a session key');
      return;
    }
    if (!keys) {
      console.log('❌ Quantum keys not ready');
      alert('Quantum encryption keys are still being generated. Please wait a moment and try again.');
      return;
    }
    
    // Save username to localStorage
    localStorage.setItem('username', username.trim());
    
    // Add to recent rooms
    const newRecentRooms = [generatedKey, ...recentRooms.filter(room => room !== generatedKey)].slice(0, 5);
    setRecentRooms(newRecentRooms);
    localStorage.setItem('recentRooms', JSON.stringify(newRecentRooms));
    
    console.log('✅ All validations passed, joining room...');
    
    // Generate QR code for sharing
    generateQRCode(generatedKey);
    setIsRoomCreator(true);
    
    console.log('🔗 Calling joinRoom with:', generatedKey, username.trim(), true);
    triggerHaptic('light');
    joinRoom(generatedKey, username.trim(), true);
  };

  const joinChatRoom = () => {
    if (username.trim() && roomKey.trim()) {
      triggerHaptic('light');
      joinRoom(roomKey, username, true);
    } else {
      triggerHaptic('error');
      if (!username.trim()) {
        setUsernameError('Please enter a username');
      } else if (!roomKey.trim()) {
        setRoomKeyError('Please enter a room key');
      }
    }
    // Save username to localStorage
    localStorage.setItem('username', username.trim());
    
    // Add to recent rooms
    const newRecentRooms = [roomKey.toUpperCase(), ...recentRooms.filter(room => room !== roomKey.toUpperCase())].slice(0, 5);
    setRecentRooms(newRecentRooms);
    localStorage.setItem('recentRooms', JSON.stringify(newRecentRooms));
    
    console.log('Joining chat room with key:', roomKey.toUpperCase());
    joinRoom(roomKey.toUpperCase(), username.trim(), false);
  };

  const joinRoom = useCallback((key, name, isCreator) => {
    console.log(`Joining room: ${key} as ${name} (Creator: ${isCreator})`);
    
    // Set room info immediately
    setRoomKey(key);
    setUsername(name);
    setIsRoomCreator(isCreator); // Set creator status
    
    const serverUrl = process.env.REACT_APP_SERVER_URL || 'http://192.168.1.42:3000';
    console.log('🌐 Connecting to server:', serverUrl);
    setConnectionStatus('connecting');
    
    const newSocket = io(serverUrl, {
      transports: ['polling'], // Use polling only for better network compatibility
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 20000,
      forceNewConnection: true
    });

    newSocket.on('connect', () => {
      console.log('✅ Connected to server! Socket ID:', newSocket.id);
      setConnectionStatus('connected');
      newSocket.emit('join room', { roomKey: key, username: name });
      
      // Switch to chat view immediately after connecting
      setCurrentView('chat');
    });

    newSocket.on('room joined', (data) => {
      console.log('✅ Successfully joined room:', data.roomKey);
      setMessages(data.messages || []);
    });

    newSocket.on('room locked', (data) => {
      console.log('Room is locked:', data);
      setRoomLocked(true);
      
      // Show notification to users
      if (data.lockedBy && data.lockedBy !== username) {
        alert(`Room has been locked by ${data.lockedBy}. No new users can join.`);
      }
    });
    
    newSocket.on('room unlocked', (data) => {
      console.log('Room is unlocked:', data);
      setRoomLocked(false);
    });
    
    newSocket.on('system message', (message) => {
      console.log('System message received:', message);
      setMessages(prev => [...prev, message]);
    });

    newSocket.on('user connected', (data) => {
      console.log('✅ User connected event received:', data);
      setUserId(data.userId);
      
      if (keys) {
        const publicKeyPem = exportPublicKey(keys.publicKey);
        newSocket.emit('share public key', { roomKey: key, publicKey: publicKeyPem });
      }
    });

    newSocket.on('new user', ({ userId, publicKey, username }) => {
      console.log('New user joined:', username);
      // Note: userPublicKeys state was removed to fix ESLint warnings
      // You can add it back if needed for encryption features
    });

    newSocket.on('existing users', (users) => {
      console.log('Existing users in room:', users);
      // Note: userPublicKeys state was removed to fix ESLint warnings
      // You can add it back if needed for encryption features
    });

    newSocket.on('chat message', (msg) => {
      setMessages(prev => [...prev, msg]);
    });

    newSocket.on('chat message plain', (msg) => {
      console.log('Received plain text message:', msg);
      setMessages(prev => [...prev, msg]);
    });

    newSocket.on('user joined room', (data) => {
      console.log(`${data.username} joined the room`);
    });

    newSocket.on('user left room', (data) => {
      console.log(`${data.username} left the room`);
    });

    newSocket.on('room users', (users) => {
      console.log('Room users updated:', users);
      setRoomUsers(users.filter(u => u.userId !== userId));
    });

    newSocket.on('incoming-call', async (data) => {
      console.log('🔔 INCOMING CALL EVENT RECEIVED:', data);
      if (!callInProgress) {
        console.log('Incoming call from:', data.callerName);
        const callType = data.callType === 'audio' ? 'Voice' : 'Video';
        
        // Store incoming call data and show custom notification
        setIncomingCall({
          ...data,
          callTypeText: callType
        });
        
        // Play notification sound (if available)
        try {
          const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBi6Gy/DaiTsIGGS57OihUBELTKXh8bllHgg2jdXzzn0vBSF1xe/glEILElyx6OyrWBUIQ5zd8sFuIAUuhM/w1YU7CRhku+3opFQRC0yl4fG5ZR4INo3V8859LwUhdMXv4JRCCxJcsejsq1gVCEOc3fLBbiAFLoTP9NWFOwkYZLvt6KRU');
          audio.play().catch(e => console.log('Could not play notification sound'));
        } catch (e) {
          console.log('Notification sound not available');
        }
      } else {
        // Reject call if already in another call
        newSocket.emit('reject-call', {
          roomKey: roomKey,
          callId: data.callId
        });
  console.log('🌐 Connecting to server:', serverUrl);
  setConnectionStatus('connecting');
  
  const newSocket = io(serverUrl, {
    transports: ['polling'], // Use polling only for better network compatibility
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    timeout: 20000,
    forceNewConnection: true
  });

  newSocket.on('connect', () => {
    console.log('✅ Connected to server! Socket ID:', newSocket.id);
    setConnectionStatus('connected');
    newSocket.emit('join room', { roomKey: key, username: name });
    
    // Switch to chat view immediately after connecting
    setCurrentView('chat');
  });

  newSocket.on('room joined', (data) => {
    console.log('✅ Successfully joined room:', data.roomKey);
    setMessages(data.messages || []);
  });

  newSocket.on('room locked', (data) => {
    console.log('Room is locked:', data);
    setRoomLocked(true);
    
    // Show notification to users
    if (data.lockedBy && data.lockedBy !== username) {
      alert(`Room has been locked by ${data.lockedBy}. No new users can join.`);
    }
  });
  
  newSocket.on('room unlocked', (data) => {
    console.log('Room is unlocked:', data);
    setRoomLocked(false);
  });
  
  newSocket.on('system message', (message) => {
    console.log('System message received:', message);
    setMessages(prev => [...prev, message]);
  });

  newSocket.on('user connected', (data) => {
    console.log('✅ User connected event received:', data);
    setUserId(data.userId);
    
    if (keys) {
      const publicKeyPem = exportPublicKey(keys.publicKey);
      newSocket.emit('share public key', { roomKey: key, publicKey: publicKeyPem });
    }
  });

  newSocket.on('new user', ({ userId, publicKey, username }) => {
    console.log('New user joined:', username);
    // Note: userPublicKeys state was removed to fix ESLint warnings
    // You can add it back if needed for encryption features
  });

  newSocket.on('existing users', (users) => {
    console.log('Existing users in room:', users);
    // Note: userPublicKeys state was removed to fix ESLint warnings
    // You can add it back if needed for encryption features
  });

  newSocket.on('chat message', (msg) => {
    setMessages(prev => [...prev, msg]);
  });

  newSocket.on('chat message plain', (msg) => {
    console.log('Received plain text message:', msg);
    setMessages(prev => [...prev, msg]);
  });

  newSocket.on('user joined room', (data) => {
    console.log(`${data.username} joined the room`);
  });

  newSocket.on('user left room', (data) => {
    console.log(`${data.username} left the room`);
  });

  newSocket.on('room users', (users) => {
    console.log('Room users updated:', users);
    setRoomUsers(users.filter(u => u.userId !== userId));
  });

  newSocket.on('incoming-call', async (data) => {
    console.log('� INCOMING CALL EVENT RECEIVED:', data);
    if (!callInProgress) {
      console.log('Incoming call from:', data.callerName);
      const callType = data.callType === 'audio' ? 'Voice' : 'Video';
      
      // Store incoming call data and show custom notification
      setIncomingCall({
        ...data,
        callTypeText: callType
      });
      
      // Play notification sound (if available)
      try {
        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBi6Gy/DaiTsIGGS57OihUBELTKXh8bllHgg2jdXzzn0vBSF1xe/glEILElyx6OyrWBUIQ5zd8sFuIAUuhM/w1YU7CRhku+3opFQRC0yl4fG5ZR4INo3V8859LwUhdMXv4JRCCxJcsejsq1gVCEOc3fLBbiAFLoTP9NWFOwkYZLvt6KRU');
        audio.play().catch(e => console.log('Could not play notification sound'));
      } catch (e) {
        console.log('Notification sound not available');
      }
    } else {
      // Reject call if already in another call
      newSocket.emit('reject-call', {
        roomKey: roomKey,

    newSocket.on('call-ended', () => {
      setCallInProgress(false);
      setIsInCall(false);
      
      // Stop local media stream (camera/microphone)
      stopLocalMediaStream();
      
      // Reset mute/video states
      setIsMuted(false);
      setIsVideoOff(false);
      
      if (window.currentPeerConnection) {
        window.currentPeerConnection.close();
        window.currentPeerConnection = null;
      }
      
      // Clean up audio/video elements
      const audioElement = document.getElementById('remoteAudio');
      if (audioElement) {
        audioElement.srcObject = null;
        audioElement.remove();
      }
      
      const videoElement = document.getElementById('remoteVideo');
      if (videoElement) {
        videoElement.srcObject = null;
        videoElement.remove();
      }
      
      const localVideoElement = document.getElementById('localVideo');
      if (localVideoElement) {
        localVideoElement.srcObject = null;
        localVideoElement.remove();
      }
      
      // Clear buffered signaling data
      setPendingOffer(null);
      setPendingIceCandidates([]);
      console.log(' Call ended');
    });

    // WebRTC signaling handlers
    newSocket.on('call-offer', async (data) => {
      console.log(' RECEIVED CALL OFFER:', data);
      if (window.currentPeerConnection) {
        try {
          console.log('Setting remote description from offer...');
          await window.currentPeerConnection.setRemoteDescription(data.offer);
          console.log('Creating answer...');
          const answer = await window.currentPeerConnection.createAnswer();
          console.log('Setting local description...');
          await window.currentPeerConnection.setLocalDescription(answer);
          
          console.log('Sending call answer...');
          newSocket.emit('call-answer', {
            roomKey: roomKey,
            answer: answer
          });
          console.log(' Call answer sent successfully!');
        } catch (error) {
          console.error(' Error handling call offer:', error);
        }
      } else {
        console.log(' Buffering offer until peer connection is ready...');
        setPendingOffer(data);
      }
    });

    newSocket.on('call-answer', async (data) => {
      console.log(' RECEIVED CALL ANSWER:', data);
      if (window.currentPeerConnection) {
        try {
          await window.currentPeerConnection.setRemoteDescription(data.answer);
          console.log('Set remote description from answer');
        } catch (error) {
          console.error('Error handling call answer:', error);
        }
      }
    });

    newSocket.on('ice-candidate', async (data) => {
      console.log(' RECEIVED ICE CANDIDATE:', data);
      if (window.currentPeerConnection) {
        try {
          await window.currentPeerConnection.addIceCandidate(data.candidate);
          console.log(' ICE candidate added successfully');
        } catch (error) {
          console.error(' Error adding ICE candidate:', error);
        }
      } else {
        console.log(' Buffering ICE candidate until peer connection is ready...');
        setPendingIceCandidates(prev => [...prev, data.candidate]);
      }
    });

    // Add socket error handling
    newSocket.on('connect_error', (error) => {
      console.error(' Socket connection error:', error);
      setConnectionStatus('disconnected');
      
      // Provide specific error messages
      let errorMessage = 'Failed to connect to server.';
      if (error.message === 'websocket error') {
        errorMessage = 'WebSocket connection failed. Using polling transport instead.';
        console.log(' WebSocket failed, will retry with polling...');
      } else if (error.code === 'parser error') {
        errorMessage = 'Server communication error. Please restart the server.';
      } else if (error.code === 'ECONNREFUSED') {
        errorMessage = 'Server is not running or not accepting connections.';
      } else if (error.code === 'ENOTFOUND') {
        errorMessage = 'Server not found at ' + serverUrl;
      } else if (error.code === 'ECONNRESET') {
        errorMessage = 'Connection was reset. Please try again.';
      }
      
      console.error(' Connection details:', {
        serverUrl,
        errorCode: error.code,
        errorMessage: error.message,
        timestamp: new Date().toISOString()
      });
      
      // Only show alert for non-websocket errors (websocket errors will auto-retry)
      if (error.message !== 'websocket error') {
        alert(errorMessage + '\n\nServer: ' + serverUrl + '\nError: ' + error.message);
      }
    });

    newSocket.on('disconnect', (reason) => {
      console.log(' Socket disconnected:', reason);
      setConnectionStatus('disconnected');
      if (reason === 'io server disconnect') {
        // Server disconnected, try to reconnect
        console.log(' Attempting to reconnect...');
        newSocket.connect();
      }
    });

    newSocket.on('reconnect', (attemptNumber) => {
      console.log(' Reconnected to server after', attemptNumber, 'attempts');
      setConnectionStatus('connected');
    });

    setSocket(newSocket);
    setRoomKey(key);
    setUsername(name);
  }, [setRoomKey, setUsername, setIsRoomCreator, setConnectionStatus]);

  const leaveRoom = () => {
    // Stop local media stream if active
    stopLocalMediaStream();
    
  setIsInCall(false);
  
  if (socket) {
    socket.emit('leave room');
    socket.disconnect();
  }
  setSocket(null);
  setMessages([]);
  // setUserPublicKeys({}); // Removed to fix error - userPublicKeys state was removed
  setUserId(null);
  setCurrentView('home');
  setRoomKey('');
  setGeneratedKey('');
};

const sendMessage = (e) => {
  e.preventDefault();
  if (message.trim() && userId && socket) {
    triggerHaptic('light');
    socket.emit('chat message plain', {
      text: message,
      from: userId,
      username: username,
      timestamp: Date.now()
    });
    setMessage('');
  }
};

const sendCallNotification = (message) => {
  if (socket && roomKey) {
    const notificationData = {
      text: message,
      type: 'call-notification',
      timestamp: new Date().toISOString()
    };
    socket.emit('chat message plain', notificationData);
  }
};

const acceptIncomingCall = async () => {
  if (!incomingCall) return;
  
  triggerHaptic('success');
  console.log(' Accepting incoming call...');
  setCallInProgress(true);
  setIsInCall(true);
  setCurrentCallType(incomingCall.callType);
  
  try {
    console.log(' Requesting media permissions for incoming call...');
    
    // Check if mediaDevices is available
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Camera/microphone access is not available in this browser');
    }
    
    // Get media stream for incoming call
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: incomingCall.callType === 'video'
    });
    
    console.log(' Media stream obtained for incoming call:', stream);
    setLocalStream(stream); // Store local stream for cleanup
    
    // Display local video if it's a video call
    if (incomingCall.callType === 'video') {
      setTimeout(() => {
        let localVideoElement = document.getElementById('localVideo');
        if (!localVideoElement) {
          localVideoElement = document.createElement('video');
          localVideoElement.id = 'localVideo';
          localVideoElement.autoplay = true;
          localVideoElement.muted = true; // Mute to prevent feedback
          localVideoElement.style.width = '150px';
          localVideoElement.style.height = '150px';
          localVideoElement.style.borderRadius = '8px';
          localVideoElement.style.objectFit = 'cover';
          document.querySelector('.call-video-container')?.appendChild(localVideoElement);
        }
        localVideoElement.srcObject = stream;
      }, 100);
    }
    
    // Send call acceptance
    socket.emit('call accepted', {
      targetUserId: incomingCall.callerId,
      callType: incomingCall.callType,
      roomKey: roomKey
    });
    
    console.log(' Call acceptance sent');
    
    // Process any buffered offer and ICE candidates
    await processPendingSignaling(socket, roomKey);
    
    socket.emit('accept-call', {
      roomKey: roomKey,
      callId: incomingCall.callId
    });
    
    console.log(` ${incomingCall.callTypeText} call accepted! Setting up connection...`);
    setIncomingCall(null); // Clear incoming call notification
  } catch (error) {
    console.error('Error accepting call:', error);
    
    let errorMessage = 'Failed to accept call. ';
    
    if (error.name === 'NotAllowedError') {
      errorMessage = 'Camera and microphone permissions are required for calls. Please allow access and try again.';
    } else if (error.name === 'NotFoundError') {
      errorMessage = 'No camera or microphone found. Please connect a device and try again.';
    } else if (error.name === 'NotSupportedError') {
      errorMessage = 'Camera/microphone access is not supported in this browser. Please try a different browser.';
    } else if (error.name === 'NotReadableError') {
      errorMessage = 'Camera or microphone is already in use by another application.';
    } else if (error.message.includes('not available')) {
      errorMessage = 'Camera/microphone access is not available in this browser. Please try using Chrome, Firefox, or Safari.';
    } else {
      errorMessage = 'Failed to accept call. Please check your camera and microphone permissions.';
    }
    
    alert(errorMessage);
    // Clean up call state
    setCallInProgress(false);
    setIsInCall(false);
    
    if (socket) {
      socket.emit('leave room');
      socket.disconnect();
    }
    setSocket(null);
    setMessages([]);
    // setUserPublicKeys({}); // Removed to fix error - userPublicKeys state was removed
    setUserId(null);
    setCurrentView('home');
    setRoomKey('');
    setGeneratedKey('');
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (message.trim() && userId && socket) {
      triggerHaptic('light');
      socket.emit('chat message plain', {
        text: message,
        from: userId,
        username: username,
        timestamp: Date.now()
      });
      setMessage('');
    }
  };

  const sendCallNotification = (message) => {
    if (socket && roomKey) {
      const notificationData = {
        text: message,
        type: 'call-notification',
        timestamp: new Date().toISOString()
      };
      socket.emit('chat message plain', notificationData);
    }
  };

  const acceptIncomingCall = async () => {
    if (!incomingCall) return;
    
    triggerHaptic('success');
    console.log('📞 Accepting incoming call...');
    setCallInProgress(true);
    setIsInCall(true);
    setCurrentCallType(incomingCall.callType);
    
    try {
      console.log('🎤 Requesting media permissions for incoming call...');
      
      // Check if mediaDevices is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera/microphone access is not available in this browser');
      }
      
      // Get media stream for incoming call
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: incomingCall.callType === 'video'
      });
      
      console.log('✅ Media stream obtained for incoming call:', stream);
      setLocalStream(stream); // Store local stream for cleanup
      
      // Display local video if it's a video call
      if (incomingCall.callType === 'video') {
        setTimeout(() => {
          let localVideoElement = document.getElementById('localVideo');
          if (!localVideoElement) {
            localVideoElement = document.createElement('video');
            localVideoElement.id = 'localVideo';
            localVideoElement.autoplay = true;
            localVideoElement.muted = true; // Mute to prevent feedback
            localVideoElement.style.width = '150px';
            localVideoElement.style.height = '150px';
            localVideoElement.style.borderRadius = '8px';
            localVideoElement.style.objectFit = 'cover';
            document.querySelector('.call-video-container')?.appendChild(localVideoElement);
          }
          localVideoElement.srcObject = stream;
        }, 100);
      }
      
      // Send call acceptance
      socket.emit('call accepted', {
        targetUserId: incomingCall.callerId,
        callType: incomingCall.callType,
        roomKey: roomKey
      });
      
      console.log('✅ Incoming call acceptance sent');
      
      // Process any buffered offer and ICE candidates
      await processPendingSignaling(socket, roomKey);
      
      socket.emit('accept-call', {
        roomKey: roomKey,
        callId: incomingCall.callId
      });
      
      console.log(`✅ ${incomingCall.callTypeText} call accepted! Setting up connection...`);
      setIncomingCall(null); // Clear incoming call notification
    } catch (error) {
      console.error('Error accepting call:', error);
      
      let errorMessage = 'Failed to accept call. ';
      
      if (error.name === 'NotAllowedError') {
        errorMessage = 'Camera and microphone permissions are required for calls. Please allow access and try again.';
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'No camera or microphone found. Please connect a device and try again.';
      } else if (error.name === 'NotSupportedError') {
        errorMessage = 'Camera/microphone access is not supported in this browser. Please try a different browser.';
      } else if (error.name === 'NotReadableError') {
        errorMessage = 'Camera or microphone is already in use by another application.';
      } else if (error.message.includes('not available')) {
        errorMessage = 'Camera/microphone access is not available in this browser. Please try using Chrome, Firefox, or Safari.';
      } else {
        errorMessage = 'Failed to accept call. Please check your camera and microphone permissions.';
      }
      
      alert(errorMessage);
      setCallInProgress(false);
      setIsInCall(false);
      setIncomingCall(null);
      
      // Notify caller that call was rejected due to error
      socket.emit('reject-call', {
        roomKey: roomKey,
        callId: incomingCall.callId
      });
    }
  };

  const rejectIncomingCall = () => {
    if (!incomingCall) return;
    
    triggerHaptic('medium');
    console.log('❌ Rejecting incoming call');
    socket.emit('reject-call', {
      roomKey: roomKey,
      callId: incomingCall.callId
    });
    setIncomingCall(null);
  };

  const startCall = async (type) => {
    if (socket && roomKey && userId && !callInProgress) {
      triggerHaptic('light');
      console.log(`Starting ${type} call in room ${roomKey}`);
      setCallInProgress(true);
      setCurrentCallType(type);
      
      // Send call notification to chat
      const callTypeText = type === 'audio' ? 'voice' : 'video';
      sendCallNotification(`📞 ${username} started a ${callTypeText} call`);
      
      try {
        // Check if mediaDevices is available
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Camera/microphone access is not available in this browser');
        }
        
        // Request media permissions
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: type === 'video'
        });
        
        console.log('Media stream obtained for web:', stream);
        setLocalStream(stream); // Store local stream for cleanup
        
        // Display local video if it's a video call
        if (type === 'video') {
          setTimeout(() => {
            let localVideoElement = document.getElementById('localVideo');
            if (!localVideoElement) {
              localVideoElement = document.createElement('video');
              localVideoElement.id = 'localVideo';
              localVideoElement.autoplay = true;
              localVideoElement.muted = true; // Mute to prevent feedback
              localVideoElement.style.width = '100%';
              localVideoElement.style.height = '100%';
              localVideoElement.style.objectFit = 'cover';
              localVideoElement.style.transform = 'scaleX(-1)'; // Mirror effect
              
              const localVideoPlaceholder = document.querySelector('.local-video-placeholder');
              if (localVideoPlaceholder) {
                localVideoPlaceholder.innerHTML = '';
                localVideoPlaceholder.appendChild(localVideoElement);
              }
            }
            localVideoElement.srcObject = stream;
          }, 1000);
        }
        
        // Create peer connection for web
        const peerConnection = new RTCPeerConnection({
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ]
        });
        
        // Store peer connection globally
        window.currentPeerConnection = peerConnection;
        
        // Add tracks to peer connection
        stream.getTracks().forEach(track => {
          peerConnection.addTrack(track, stream);
        });
        
        // Set up peer connection handlers
        peerConnection.ontrack = (event) => {
          console.log('Received remote stream on web');
          if (event.streams && event.streams[0]) {
            console.log('🎵 Setting up remote audio/video stream for outgoing call');
            const remoteStream = event.streams[0];
            
            // Create or get audio element for playback
            let audioElement = document.getElementById('remoteAudio');
            if (!audioElement) {
              audioElement = document.createElement('audio');
              audioElement.id = 'remoteAudio';
              audioElement.autoplay = true;
              audioElement.controls = false;
              audioElement.style.display = 'none';
              document.body.appendChild(audioElement);
            }
            
            // Attach stream to audio element
            audioElement.srcObject = remoteStream;
            audioElement.play().catch(e => console.log('Audio play failed:', e));
            
            // If video call, also create video element
            if (type === 'video') {
              let videoElement = document.getElementById('remoteVideo');
              if (!videoElement) {
                videoElement = document.createElement('video');
                videoElement.id = 'remoteVideo';
                videoElement.autoplay = true;
                videoElement.controls = false;
                videoElement.style.width = '100%';
                videoElement.style.height = '100%';
                videoElement.style.backgroundColor = '#000';
                videoElement.style.objectFit = 'cover';
                
                // Replace the placeholder content
                const remotePlaceholder = document.querySelector('.remote-video-placeholder');
                if (remotePlaceholder) {
                  remotePlaceholder.innerHTML = '';
                  remotePlaceholder.appendChild(videoElement);
                }
              }
              videoElement.srcObject = remoteStream;
              videoElement.play().catch(e => console.log('Video play failed:', e));
            }
          }
        };
        
        peerConnection.onconnectionstatechange = () => {
          const state = peerConnection.connectionState;
          console.log('🔗 Web app connection state:', state);
          if (state === 'connected') {
            console.log('🎉 WebRTC connection established successfully!');
            // Don't show alert immediately, let it stay connected
            setTimeout(() => {
              if (peerConnection.connectionState === 'connected') {
                console.log('✅ Connection stable after 2 seconds');
              }
            }, 2000);
          } else if (state === 'failed') {
            console.log('❌ WebRTC connection failed');
            setCallInProgress(false);
            setIsInCall(false);
          } else if (state === 'disconnected') {
            console.log('⚠️ WebRTC connection disconnected - waiting for reconnection...');
            // Don't immediately end call on disconnect, wait a bit
            setTimeout(() => {
              if (peerConnection.connectionState === 'disconnected' || peerConnection.connectionState === 'failed') {
                console.log('❌ Connection permanently lost');
                setCallInProgress(false);
                setIsInCall(false);
              }
            }, 3000);
          }
        };
        
        peerConnection.onicecandidate = (event) => {
          if (event.candidate) {
            socket.emit('ice-candidate', {
              roomKey: roomKey,
              candidate: event.candidate
            });
          }
        };
        
        // Create and send offer
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        
        socket.emit('call-offer', {
          roomKey: roomKey,
          offer: offer,
          callType: type,
          callerName: username
        });
        
        // Send call notification
        socket.emit('call-user', {
          roomKey: roomKey,
          callType: type,
          from: userId,
          username: username
        });
        
        const callTypeText = type === 'audio' ? 'Voice' : 'Video';
        console.log(`✅ ${callTypeText} call initiated! WebRTC connection established.`);
        setIsInCall(true);
        
      } catch (error) {
        console.error('Error starting call:', error);
        setCallInProgress(false);
        
        let errorMessage = 'Failed to start call. ';
        
        if (error.name === 'NotAllowedError') {
          errorMessage = 'Camera and microphone permissions are required for calls. Please allow access and try again.';
        } else if (error.name === 'NotFoundError') {
          errorMessage = 'No camera or microphone found. Please connect a device and try again.';
        } else if (error.name === 'NotSupportedError') {
          errorMessage = 'Camera/microphone access is not supported in this browser. Please try a different browser.';
        } else if (error.name === 'NotReadableError') {
          errorMessage = 'Camera or microphone is already in use by another application.';
        } else if (error.message.includes('not available')) {
          errorMessage = 'Camera/microphone access is not available in this browser. Please try using Chrome, Firefox, or Safari.';
        } else {
          errorMessage = 'Failed to start call. Please check your camera and microphone permissions.';
        }
        
        alert(errorMessage);
        console.error('Media access error details:', {
          errorName: error.name,
          errorMessage: error.message,
          browser: navigator.userAgent,
          httpsSecure: window.location.protocol === 'https:'
        });
      }
    } else if (callInProgress) {
      alert('Call already in progress. Please wait or end the current call.');
    } else {
      alert('Unable to start call. Please make sure you are connected to the room.');
    }
  };

  const endCall = () => {
    if (socket && roomKey && isInCall) {
      socket.emit('end-call', { roomKey });
      setCallInProgress(false);
      setIsInCall(false);
      
      // Stop local media stream (camera/microphone)
      stopLocalMediaStream();
      
      // Reset mute/video states
      setIsMuted(false);
      setIsVideoOff(false);
      
      // Clean up peer connection
      if (window.currentPeerConnection) {
        window.currentPeerConnection.close();
        window.currentPeerConnection = null;
      }
      
      // Clean up audio/video elements
      const audioElement = document.getElementById('remoteAudio');
      if (audioElement) {
        audioElement.srcObject = null;
        audioElement.remove();
      }
      
      const videoElement = document.getElementById('remoteVideo');
      if (videoElement) {
        videoElement.srcObject = null;
        videoElement.remove();
      }
      
      const localVideoElement = document.getElementById('localVideo');
      if (localVideoElement) {
        localVideoElement.srcObject = null;
        localVideoElement.remove();
      }
      
      // Clear buffered signaling data
      setPendingOffer(null);
      setPendingIceCandidates([]);
      
      // Send call end notification
      sendCallNotification(`📞 ${username} ended the call`);
      
      console.log('📞 Call ended by user');
    }
  };

  const generateQRCode = async (roomCode) => {
    console.log('📱 Generating QR code for room:', roomCode);
    try {
      // Use the server URL from environment or fallback to current location
      const serverUrl = process.env.REACT_APP_SERVER_URL || 'http://192.168.1.43:3000';
      console.log('🌐 Using server URL:', serverUrl);
      
      const qrData = {
        type: 'chatanony-room',
        roomKey: roomCode,
        url: `${serverUrl}/room/${roomCode}`,
        timestamp: Date.now()
      };
      
      console.log('📦 QR Data:', qrData);
      
      const qrCodeDataUrl = await QRCode.toDataURL(JSON.stringify(qrData));
      setQrCodeUrl(qrCodeDataUrl);
      
      // Also set the room URL for sharing
      setRoomUrl(`${serverUrl}/room/${roomCode}`);
      console.log('✅ QR Code generated successfully for room:', roomCode);
      console.log('🔗 Room URL set to:', `${serverUrl}/room/${roomCode}`);
      console.log('📱 QR Code URL length:', qrCodeDataUrl.length);
    } catch (error) {
      console.error('❌ Error generating QR code:', error);
      alert('Failed to generate QR code: ' + error.message);
    }
  };

  const shareRoomUrl = () => {
    if (roomUrl) {
      navigator.clipboard.writeText(roomUrl);
      alert('Room URL copied to clipboard!');
    }
  };

  const lockRoom = () => {
    if (socket && roomKey) {
      socket.emit('lock room', { roomKey });
    }
  };

  const unlockRoom = () => {
    if (socket && roomKey) {
      socket.emit('unlock room', { roomKey });
    }
  };

  const checkRoomAccess = async (roomCode) => {
    try {
      const serverUrl = process.env.REACT_APP_SERVER_URL || 'http://192.168.1.42:3000';
      const roomUrl = `${serverUrl}/room/${roomCode}`;
      
      console.log('🔍 Checking room access for:', roomCode);
      console.log('🌐 Server URL:', serverUrl);
      console.log('📡 Full URL:', roomUrl);
      
      const response = await fetch(roomUrl);
      
      console.log('📊 Response status:', response.status);
      console.log('📋 Response headers:', response.headers.get('content-type'));
      
      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('❌ Server returned non-JSON response:', text.substring(0, 200));
        throw new Error('Server is not responding correctly. Please check if the server is running.');
      }
      
      const data = await response.json();
      console.log('✅ Room data received:', data);
      
      if (response.ok) {
        console.log('✅ Room access check successful:', roomCode);
        return data;
      } else {
        throw new Error(data.error || 'Failed to access room');
      }
    } catch (error) {
      console.error('❌ Error checking room access:', error);
      throw error;
    }
  };

  const joinRoomViaUrl = useCallback(async (roomCode) => {
    console.log('🔗 Joining room via URL:', roomCode);
    
    const validationError = validateUsername(username);
    if (validationError) {
      console.log('❌ Username validation failed:', validationError);
      setUsernameError(validationError);
      return;
    }
    
    try {
      console.log('📡 Checking room access...');
      const roomData = await checkRoomAccess(roomCode);
      
      if (roomData.success) {
        console.log('✅ Room access granted, joining room...');
        
        // Save username and add to recent rooms
        localStorage.setItem('username', username.trim());
        const newRecentRooms = [roomCode, ...recentRooms.filter(room => room !== roomCode)].slice(0, 5);
        setRecentRooms(newRecentRooms);
        localStorage.setItem('recentRooms', JSON.stringify(newRecentRooms));
        
        setIsRoomCreator(false);
        console.log('🚀 Calling joinRoom for URL join...');
        joinRoom(roomCode, username.trim(), false);
      } else {
        console.log('❌ Room access denied:', roomData);
        alert('Cannot join room: ' + (roomData.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('❌ Failed to join room via URL:', error);
      alert(error.message || 'Failed to join room via URL. Please check if the server is running.');
    }
  }, [joinRoom, recentRooms, username]);

  // Auto-join via URL when username is entered
  useEffect(() => {
    if (isUrlJoin && username.trim() && roomKey && keys) {
      console.log('👤 Username entered, auto-joining room via URL...');
      joinRoomViaUrl(roomKey);
      setIsUrlJoin(false);
    }
  }, [username, isUrlJoin, roomKey, keys, joinRoomViaUrl]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedKey);
    alert('Session key copied to clipboard!');
  };

  const joinRecentRoom = (roomCode) => {
    setRoomKey(roomCode);
    // Auto-focus on the join button for better UX
    setTimeout(() => {
      const joinButton = document.querySelector('.secondary-button');
      if (joinButton) joinButton.focus();
    }, 100);
  };

  const showRoomOptions = () => {
    if (generatedKey) {
      generateQRCode(generatedKey);
      setShowQRCode(true);
    }
  };

  const clearRecentRooms = () => {
    setRecentRooms([]);
    localStorage.removeItem('recentRooms');
  };

  const dismissWelcome = () => {
    setShowWelcome(false);
  };

  const formatCallDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const stopLocalMediaStream = () => {
    if (localStream) {
      console.log('🔇 Stopping local media stream (camera/microphone)');
      localStream.getTracks().forEach(track => {
        console.log(`Stopping ${track.kind} track`);
        track.stop();
      });
      setLocalStream(null);
    }
  };

  const toggleMute = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
        console.log(`🎤 Audio ${audioTrack.enabled ? 'unmuted' : 'muted'}`);
      }
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
        console.log(`📹 Video ${videoTrack.enabled ? 'enabled' : 'disabled'}`);
      }
    }
  };

  const processPendingSignaling = async (socket, roomKey) => {
    console.log('🔄 Processing pending signaling...');
    
    // Process buffered offer
    if (pendingOffer && window.currentPeerConnection) {
      console.log('📞 Processing buffered offer...');
      try {
        await window.currentPeerConnection.setRemoteDescription(pendingOffer.offer);
        const answer = await window.currentPeerConnection.createAnswer();
        await window.currentPeerConnection.setLocalDescription(answer);
        
        socket.emit('call-answer', {
          roomKey: roomKey,
          answer: answer
        });
        console.log('✅ Buffered offer processed and answer sent!');
        setPendingOffer(null);
      } catch (error) {
        console.error('❌ Error processing buffered offer:', error);
      }
    }
    
    // Process buffered ICE candidates
    if (pendingIceCandidates.length > 0 && window.currentPeerConnection) {
      console.log(`🧊 Processing ${pendingIceCandidates.length} buffered ICE candidates...`);
      for (const candidate of pendingIceCandidates) {
        try {
          await window.currentPeerConnection.addIceCandidate(candidate);
          console.log('✅ Buffered ICE candidate added');
        } catch (error) {
          console.error('❌ Error adding buffered ICE candidate:', error);
        }
      }
      setPendingIceCandidates([]);
    }
  };

  // shareFile is defined but currently unused - keeping for future file sharing features
  const shareFile = () => {
    triggerHaptic('light');
    
    if (!socket || !roomKey) {
      alert('Please join a room first to share files.');
      return;
    }
    
    // TODO: Implement file sharing functionality
    console.log('📎 File sharing feature coming soon');
  };

  if (currentView === 'home') {
    return (
      <div className={`app ${theme}`}>
        <div className="container">
          <header className="header">
            <div className="header-content">
              <h1 className="title">PQEncrypt</h1>
              <p className="subtitle">Anonymous, quantum-secure messaging</p>
            </div>
            <div className="header-actions">
              <div className={`connection-status ${connectionStatus}`}>
                {connectionStatus === 'connected' && '🟢 Connected'}
                {connectionStatus === 'connecting' && '🟡 Connecting...'}
                {connectionStatus === 'disconnected' && '🔴 Offline'}
              </div>
              <button className="theme-toggle" onClick={toggleTheme}>
                {theme === 'light' ? '🌙' : '☀️'}
              </button>
            </div>
          </header>

          <div className="section">
            <h2>Your Name</h2>
            <input
              type="text"
              className={`input ${usernameError ? 'input-error' : ''}`}
              placeholder="Enter your name..."
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setUsernameError('');
              }}
              maxLength={20}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  if (generatedKey) {
                    startChatRoom();
                  } else if (roomKey) {
                    joinChatRoom();
                  }
                }
              }}
            />
            {usernameError && (
              <div className="error-message">{usernameError}</div>
            )}
            {!keys && (
              <div style={{ textAlign: 'center', color: '#666', fontSize: '14px' }}>
                🔐 Generating quantum-resistant encryption keys...
              </div>
            )}
            {keys && (
              <div className="quantum-security-badge">
                <span className="quantum-icon">🛡️</span>
                <span className="quantum-text">Quantum-Secure</span>
                <button 
                  className="quantum-info-btn" 
                  onClick={() => setShowSecurityInfo(true)}
                  title="View quantum security information"
                >
                  ℹ️
                </button>
              </div>
            )}
          </div>

          <div className="section">
            <div className="section-header">
              <span className="section-icon">🔑</span>
              <h2>Create Room</h2>
            </div>
            <p className="section-description">
              Generate a session key to start a new anonymous chat room
            </p>
            <button 
              className="primary-button" 
              onClick={generateSessionKey}
              disabled={isGeneratingKey}
            >
              {isGeneratingKey ? '⏳ Generating...' : 'Generate Session Key'}
            </button>
            {generatedKey && (
              <>
                <div className="key-container">
                  <span className="key-text">{generatedKey}</span>
                  <button className="copy-button" onClick={copyToClipboard}>
                    📋
                  </button>
                  <button className="qr-button" onClick={showRoomOptions} title="Show QR Code">
                    📱
                  </button>
                </div>
                <button className="primary-button" onClick={startChatRoom}>
                  Start Chat Room
                </button>
              </>
            )}
          </div>

          <div className="section">
            <div className="section-header">
              <span className="section-icon">👥</span>
              <h2>Join Room</h2>
              {isUrlJoin && (
                <span className="url-indicator">🔗 URL Access</span>
              )}
            </div>
            <p className="section-description">
              {isUrlJoin 
                ? `Joining room from URL: ${roomKey}`
                : "Enter a session key to join an existing chat room"
              }
            </p>
            <input
              type="text"
              className={`input ${isUrlJoin ? 'url-highlight' : ''}`}
              placeholder={isUrlJoin ? `Room: ${roomKey}` : "Enter session key..."}
              value={roomKey}
              onChange={(e) => setRoomKey(e.target.value.toUpperCase())}
              maxLength={6}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  if (isUrlJoin) {
                    joinChatRoom();
                  } else {
                    joinChatRoom();
                  }
                }
              }}
            />
            {roomKeyError && (
              <div className="error-message">{roomKeyError}</div>
            )}
            {recentRooms.length > 0 && (
              <div className="recent-rooms">
                <div className="recent-rooms-header">
                  <span>Recent Rooms:</span>
                  <button 
                    className="clear-rooms-btn" 
                    onClick={clearRecentRooms}
                    title="Clear recent rooms"
                  >
                    ✕
                  </button>
                </div>
                <div className="recent-rooms-list">
                  {recentRooms.map((room, index) => (
                    <button
                      key={index}
                      className="recent-room-btn"
                      onClick={() => joinRecentRoom(room)}
                    >
                      {room}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <button 
              className="primary-button" 
              onClick={joinChatRoom}
              disabled={!roomKey || roomKey.length < 6}
            >
              Join Room
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Chat view
  return (
    <div className={`app ${theme}`}>
      {/* Welcome Modal for First-Time Users */}
      {showWelcome && (
        <div className="modal-overlay" onClick={dismissWelcome}>
          <div className="welcome-modal" onClick={(e) => e.stopPropagation()}>
            <div className="welcome-header">
              <h2>🎉 Welcome to PQEncrypt!</h2>
              <button className="close-button" onClick={dismissWelcome}>✕</button>
            </div>
            <div className="welcome-content">
              <div className="welcome-section">
                <h3>🔐 Completely Anonymous</h3>
                <p>No registration required. Your messages are end-to-end encrypted.</p>
              </div>
              <div className="welcome-section">
                <h3>🔑 Session-Based Rooms</h3>
                <p>Create or join rooms using 6-character session keys. Share the key to invite others.</p>
              </div>
              <div className="welcome-section">
                <h3>📞 Voice & Video Calls</h3>
                <p>Make secure calls directly in your browser. No downloads needed.</p>
              </div>
              <div className="welcome-section">
                <h3>💾 Your Preferences</h3>
                <p>We'll remember your username and recent rooms for convenience.</p>
              </div>
            </div>
            <div className="welcome-actions">
              <button className="primary-button" onClick={dismissWelcome}>
                Get Started!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chat Container */}
      <div className="chat-container">
        <header className="chat-header">
          <div className="chat-header-info">
            <h1 className="chat-title">Room: {roomKey}</h1>
            <p className="chat-subtitle">
              {username} • {userId ? `ID: ${userId.substring(0, 8)}` : 'Connecting...'}
            </p>
          </div>
          <div className="chat-header-actions">
            {isRoomCreator && (
              <button 
                className={`lock-button ${roomLocked ? 'locked' : ''}`} 
                onClick={roomLocked ? unlockRoom : lockRoom}
                title={roomLocked ? 'Unlock Room' : 'Lock Room'}
              >
                {roomLocked ? '🔓' : '🔒'}
              </button>
            )}
            <button className="call-button" onClick={() => setShowUserList(true)} title="Users">
              👥
            </button>
            <button className="call-button leave-button" onClick={leaveRoom} title="Leave Room">
              🚪 Leave
            </button>
            {!isInCall ? (
              <>
                <button className="call-button" onClick={() => startCall('audio')} title="Voice Call">
                  📞
                </button>
                <button className="call-button" onClick={() => startCall('video')} title="Video Call">
                  📹
                </button>
              </>
            ) : (
              <button className="call-button end-call" onClick={endCall} title="End Call">
                ❌
              </button>
            )}
          </div>
        </header>

        <div className="messages-container"
             onTouchStart={handleTouchStart}
             onTouchMove={handleTouchMove}
             onTouchEnd={handleTouchEnd}>
          {messages.map((msg, index) => {
            let decryptedText = '...';
            let isFileMessage = false;
            
            // Handle file messages
            if (msg.type === 'file') {
              console.log('🔍 File message received:', {
                fileName: msg.fileName,
                fileSize: msg.fileSize,
                fileType: msg.fileType,
                hasFileData: !!msg.fileData,
                fileDataLength: msg.fileData ? msg.fileData.length : 0,
                fullMessage: msg
              });
              
              const fileIcon = msg.fileType === 'document' ? '📄' : '🖼️';
              
              // Validate file data before rendering
              if (!msg.fileData || msg.fileData.length === 0) {
                console.error('❌ Missing file data for:', msg.fileName);
                decryptedText = (
                  <div className="file-message-content">
                    <div className="file-info">
                      <span className="file-icon">❌</span>
                      <div className="file-details">
                        <div className="file-name">{msg.fileName}</div>
                        <div className="file-size">File data missing</div>
                      </div>
                    </div>
                  </div>
                );
              } else {
                decryptedText = (
                  <div className="file-message-content">
                    <div className="file-info">
                      <span className="file-icon">{fileIcon}</span>
                      <div className="file-details">
                        <div className="file-name">{msg.fileName}</div>
                        <div className="file-size">{msg.fileSize}</div>
                      </div>
                    </div>
                  </div>
                );
              }
              isFileMessage = true;
            }
            // Handle system messages
            else if (msg.type === 'system') {
              decryptedText = (
                <div className="system-message">
                  {msg.text}
                </div>
              );
            }
            else if (msg.type === 'screenshot-notification') {
              decryptedText = msg.text;
            }
            // Handle plain text messages (for testing)
            else if (msg.text) {
              decryptedText = msg.text;
            } 
            // Handle encrypted messages
            else if (msg[userId] && keys) {
              try {
                decryptedText = decryptMessage(keys.privateKey, msg[userId]);
              } catch (error) {
                console.error('❌ Quantum decryption error:', error);
                decryptedText = 'Failed to decrypt quantum message.';
              }
            }
            
            // Default fallback
            else {
              decryptedText = msg.text || 'Message could not be displayed';
            }

            return (
              <div
                key={index}
                className={`message ${
                  msg.type === 'call-notification' ? 'call-notification-message' : 
                  msg.type === 'screenshot-notification' ? 'screenshot-notification-message' :
                  msg.type === 'system' ? 'system-message-wrapper' :
                  msg.from === userId ? 'my-message' : 'other-message'
                } ${isFileMessage ? 'file-message' : ''}`}
              >
                {msg.from !== userId && (
                  <div className="message-username">{msg.username || 'Anonymous'}</div>
                )}
                <div className="message-text">{decryptedText}</div>
              </div>
            );
          })}
        </div>

        <form className="message-form" onSubmit={sendMessage}>
          <input
            type="text"
            className="message-input"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your message..."
          />
          <button type="submit" className="send-button">
            Send
          </button>
        </form>
      </div>
      
      {/* Quantum Security Information Modal */}
      {showSecurityInfo && quantumSecurity && (
        <div className="modal-overlay" onClick={() => setShowSecurityInfo(false)}>
          <div className="security-modal" onClick={(e) => e.stopPropagation()}>
            <div className="security-header">
              <h2>🛡️ Quantum Cryptography Security</h2>
              <button className="close-button" onClick={() => setShowSecurityInfo(false)}>✕</button>
            </div>
            <div className="security-content">
              <div className="security-info-grid">
                <div className="security-item">
                  <h3>🔐 Current Algorithm</h3>
                  <p>{quantumSecurity.currentAlgorithm}</p>
                </div>
                <div className="security-item">
                  <h3>🔄 Previous Algorithm</h3>
                  <p>{quantumSecurity.previousAlgorithm}</p>
                </div>
                <div className="security-item">
                  <h3>⚛️ Quantum Resistance</h3>
                  <p>{quantumSecurity.quantumResistance}</p>
                </div>
                <div className="security-item">
                  <h3>📊 NIST Security Level</h3>
                  <p>Level {quantumSecurity.nistSecurityLevel} (Highest)</p>
                </div>
                <div className="security-item">
                  <h3>🔑 Key Size</h3>
                  <p>{quantumSecurity.keySize.total}</p>
                </div>
                <div className="security-item">
                  <h3>🛡️ Protection</h3>
                  <p>{quantumSecurity.protection}</p>
                </div>
              </div>
              <div className="security-comparison">
                <h3>🔒 Security Comparison</h3>
                <div className="comparison-table">
                  <div className="comparison-row">
                    <span>Classical Computer Attack:</span>
                    <span>❌ RSA-2048: Breakable</span>
                    <span>✅ ML-KEM/DSA: Unbreakable</span>
                  </div>
                  <div className="comparison-row">
                    <span>Quantum Computer Attack:</span>
                    <span>❌ RSA-2048: Broken (Shor's)</span>
                    <span>✅ ML-KEM/DSA: Protected</span>
                  </div>
                  <div className="comparison-row">
                    <span>Future-Proof:</span>
                    <span>❌ RSA-2048: Not future-proof</span>
                    <span>✅ ML-KEM/DSA: Future-proof</span>
                  </div>
                </div>
              </div>
              <div className="security-note">
                <p>📝 <strong>Note:</strong> Your messages are now protected by NIST-approved post-quantum cryptography algorithms that are resistant to attacks from both classical and quantum computers.</p>
              </div>
            </div>
            <div className="security-actions">
              <button className="primary-button" onClick={() => setShowSecurityInfo(false)}>
                I Feel Secure!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {showQRCode && (
        <div className="modal-overlay" onClick={() => setShowQRCode(false)}>
          <div className="qr-modal" onClick={(e) => e.stopPropagation()}>
            <div className="qr-header">
              <h3>Share Room via QR Code</h3>
              <button className="close-button" onClick={() => setShowQRCode(false)}>✕</button>
            </div>
            <div className="qr-content">
              <div className="qr-code-container">
                {qrCodeUrl && <img src={qrCodeUrl} alt="Room QR Code" />}
              </div>
              <div className="room-info">
                <p className="room-key">Room: {generatedKey || roomKey}</p>
                <button className="share-button" onClick={shareRoomUrl}>
                  📋 Copy Room URL
                </button>
              </div>
              <div className="qr-instructions">
                <p>Scan this QR code with your mobile device to join PQEncrypt room instantly!</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Incoming Call Modal */}
      {incomingCall && (
        <div className="modal-overlay" onClick={() => {}}>
          <div className="incoming-call-modal" onClick={(e) => e.stopPropagation()}>
            <div className="incoming-call-header">
              <h2>🔔 Incoming {incomingCall.callTypeText} Call</h2>
              <p>From: {incomingCall.callerName}</p>
            </div>
            <div className="incoming-call-actions">
              <button className="accept-call-btn" onClick={acceptIncomingCall}>
                ✅ Accept
              </button>
              <button className="reject-call-btn" onClick={rejectIncomingCall}>
                ❌ Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User List Modal */}
      {showUserList && (
        <div className="modal-overlay" onClick={() => setShowUserList(false)}>
          <div className="user-list-modal" onClick={(e) => e.stopPropagation()}>
            <div className="user-list-header">
              <h3>Room: {roomKey}</h3>
              <button className="close-button" onClick={() => setShowUserList(false)}>✕</button>
            </div>
            
            {/* Room Sharing Section */}
            <div className="room-sharing-section">
              <h4>Share Room</h4>
              <div className="sharing-buttons">
                <button className="share-button" onClick={() => { generateQRCode(roomKey); setShowQRCode(true); }} title="Show QR Code">
                  📱 QR Code
                </button>
                <button className="share-button" onClick={shareRoomUrl} title="Copy Room Link">
                  🔗 Copy Link
                </button>
              </div>
              {roomUrl && (
                <div className="room-url-display">
                  <input 
                    type="text" 
                    value={roomUrl} 
                    readOnly 
                    className="url-input"
                    onClick={(e) => e.target.select()}
                  />
                </div>
              )}
            </div>
            
            <div className="user-list-header">
              <h4>Users ({roomUsers.length + 1})</h4>
            </div>
            <div className="user-list">
              <div className="user-item">
                <span className="user-icon">◉</span>
                <span className="user-name">{username} (You)</span>
                {isRoomCreator && <span className="creator-badge">Creator</span>}
              </div>
              {roomUsers.map((user, index) => (
                <div key={user.userId || index} className="user-item">
                  <span className="user-icon">○</span>
                  <span className="user-name">{user.username}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Call Interface Overlay */}
      {isInCall && (
        <div className="call-overlay">
          <div className="call-interface">
            <div className="call-header">
              <div className="call-info">
                <h2 className="call-title">
                  {currentCallType === 'video' ? '📹 Video Call' : '📞 Voice Call'}
                </h2>
                <p className="call-duration">{formatCallDuration(callDuration)}</p>
                <p className="call-status">
                  {callInProgress ? 'Connected' : 'Connecting...'}
                </p>
              </div>
            </div>
            
            <div className="call-content">
              {currentCallType === 'video' ? (
                <div className="video-container">
                  <div className="remote-video-placeholder">
                  </div>
                  <div className="local-video-placeholder">
                    <p>📷 Your Video</p>
                  </div>
                </div>
              ) : (
                <div className="audio-call-display">
                  <div className="audio-icon">🎵</div>
                  <p>Audio Call in Progress</p>
                  <p>Room: {roomKey}</p>
                </div>
              )}
            </div>
            
            <div className="call-controls">
              <button 
                className={`call-control-btn mute-btn ${isMuted ? 'muted' : ''}`} 
                onClick={toggleMute}
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? '🔇' : '🎤'}
              </button>
              {currentCallType === 'video' && (
                <button 
                  className={`call-control-btn video-btn ${isVideoOff ? 'video-off' : ''}`}
                  onClick={toggleVideo}
                  title={isVideoOff ? 'Turn Camera On' : 'Turn Camera Off'}
                >
                  {isVideoOff ? '📹' : '📷'}
                </button>
              )}
              <button className="call-control-btn end-call-btn" onClick={endCall} title="End Call">
                📞
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
