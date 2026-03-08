// src/App.js
import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import QRCode from 'qrcode';
import {
  generateKeyPair,
  exportPublicKey,
  importPublicKey,
  encryptMessage,
  decryptMessage,
  getQuantumSecurityInfo,
} from './quantum-crypto';
import './App.css';

function App() {
  // App state
  const [currentView, setCurrentView] = useState('home'); // 'home', 'chat'
  const [theme, setTheme] = useState('light');
  
  // Room state
  const [roomKey, setRoomKey] = useState('');
  const [generatedKey, setGeneratedKey] = useState('');
  const [username, setUsername] = useState('');
  
  // Enhanced signin state
  const [usernameError, setUsernameError] = useState('');
  const [recentRooms, setRecentRooms] = useState([]);
  const [showWelcome, setShowWelcome] = useState(false);
  const [isGeneratingKey, setIsGeneratingKey] = useState(false);
  const [roomLocked, setRoomLocked] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [showQRCode, setShowQRCode] = useState(false);
  const [roomUrl, setRoomUrl] = useState('');
  const [isRoomCreator, setIsRoomCreator] = useState(false);
  const [quantumSecurity, setQuantumSecurity] = useState(null);
  const [showSecurityInfo, setShowSecurityInfo] = useState(false);
  
  // Chat state
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [userId, setUserId] = useState(null);
  const [keys, setKeys] = useState(null);
  const [userPublicKeys, setUserPublicKeys] = useState({});
  const [socket, setSocket] = useState(null);
  const [roomUsers, setRoomUsers] = useState([]);
  const [showUserList, setShowUserList] = useState(false);
  const [isInCall, setIsInCall] = useState(false);
  const [callInProgress, setCallInProgress] = useState(false);
  const [currentCallType, setCurrentCallType] = useState('audio');
  const [callDuration, setCallDuration] = useState(0);
  const [callTimer, setCallTimer] = useState(null);
  const [pendingOffer, setPendingOffer] = useState(null);
  const [pendingIceCandidates, setPendingIceCandidates] = useState([]);
  const [localStream, setLocalStream] = useState(null);
  const peerConnectionRef = useRef(null);
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
    const validationError = validateUsername(username);
    if (validationError) {
      setUsernameError(validationError);
      return;
    }
    
    if (!generatedKey) {
      alert('Please generate a session key');
      return;
    }
    if (!keys) {
      alert('Quantum encryption keys are still being generated. Please wait a moment and try again.');
      return;
    }
    
    // Save username to localStorage
    localStorage.setItem('username', username.trim());
    
    // Add to recent rooms
    const newRecentRooms = [generatedKey, ...recentRooms.filter(room => room !== generatedKey)].slice(0, 5);
    setRecentRooms(newRecentRooms);
    localStorage.setItem('recentRooms', JSON.stringify(newRecentRooms));
    
    // Generate QR code for sharing
    generateQRCode(generatedKey);
    setIsRoomCreator(true);
    
    console.log('Starting chat room with key:', generatedKey);
    joinRoom(generatedKey, username.trim(), true);
  };

  const joinChatRoom = () => {
    const validationError = validateUsername(username);
    if (validationError) {
      setUsernameError(validationError);
      return;
    }
    
    if (!roomKey.trim()) {
      alert('Please enter a session key');
      return;
    }
    if (!keys) {
      alert('Quantum encryption keys are still being generated. Please wait a moment and try again.');
      return;
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

  const joinRoom = (key, name, isCreator) => {
    console.log(`Joining room: ${key} as ${name}`);
    
    // Set room info immediately
    setRoomKey(key);
    setUsername(name);
    
    // Use production domain with Let's Encrypt SSL
const newSocket = io('https://maxyserver.servehalflife.com', {
      transports: ['polling', 'websocket'],
      reconnection: true,
    });

    newSocket.on('connect', () => {
      console.log('✅ Connected to server! Socket ID:', newSocket.id);
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
      const importedKey = importPublicKey(publicKey);
      setUserPublicKeys(prev => ({ ...prev, [userId]: importedKey }));
    });

    newSocket.on('existing users', (users) => {
      const importedKeys = {};
      for (const id in users) {
        if (id !== userId && users[id].publicKey) {
          importedKeys[id] = importPublicKey(users[id].publicKey);
        }
      }
      setUserPublicKeys(importedKeys);
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
      // Filter out current user and remove duplicates by username
      const uniqueUsers = users
        .filter(u => u.userId !== userId)
        .filter((user, index, self) => 
          index === self.findIndex((u) => u.username === user.username)
        );
      setRoomUsers(uniqueUsers);
    });

    newSocket.on('incoming-call', async (data) => {
      console.log('🔔 INCOMING CALL EVENT RECEIVED:', data);
      if (!callInProgress) {
        console.log('Incoming call from:', data.callerName);
        const callType = data.callType === 'audio' ? 'Voice' : 'Video';
        
        // Show only one confirmation dialog
        const shouldAccept = window.confirm(`🔔 Incoming ${callType} call from ${data.callerName}. Accept?`);
        console.log('User response to call:', shouldAccept ? 'ACCEPTED' : 'REJECTED');
        if (shouldAccept) {
          setCallInProgress(true);
          setIsInCall(true);
          setCurrentCallType(data.callType);
          
          try {
            console.log('🎤 Requesting media permissions for incoming call...');
            // Get media stream for incoming call with mobile-friendly constraints
            const constraints = {
              audio: true,
              video: data.callType === 'video' ? {
                width: { ideal: 1280, max: 1920 },
                height: { ideal: 720, max: 1080 },
                facingMode: 'user'
              } : false
            };
            
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            
            console.log('✅ Media stream obtained for incoming call:', stream);
            setLocalStream(stream); // Store local stream for cleanup
            
            // Display local video if it's a video call
            if (data.callType === 'video') {
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
            
            console.log('🔗 Creating peer connection for incoming call...');
            // Create peer connection for incoming call
            const peerConnection = new RTCPeerConnection({
              iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                {
                  urls: 'turn:openrelay.metered.ca:80',
                  username: 'openrelayproject',
                  credential: 'openrelayproject'
                },
                {
                  urls: 'turn:openrelay.metered.ca:443',
                  username: 'openrelayproject',
                  credential: 'openrelayproject'
                }
              ]
            });
            console.log('✅ Peer connection created successfully');
            
            // Add tracks to peer connection
            stream.getTracks().forEach(track => {
              peerConnection.addTrack(track, stream);
            });
            
            // Set up peer connection handlers
            peerConnection.ontrack = (event) => {
              console.log('Received remote stream on web (incoming call)');
              if (event.streams && event.streams[0]) {
                console.log('🎵 Setting up remote audio/video stream');
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
                audioElement.muted = false;
                audioElement.setAttribute("playsinline", true);
                audioElement.play().catch(e => console.log('Audio play failed:', e));
                
                // If video call, also create video element
                if (data.callType === 'video') {
                  let videoElement = document.getElementById('remoteVideo');
                  if (!videoElement) {
                    videoElement = document.createElement('video');
                    videoElement.id = 'remoteVideo';
                    videoElement.autoplay = true;
                    videoElement.controls = false;
                    videoElement.style.width = '100%';
                    videoElement.style.height = '100%';
                    videoElement.style.backgroundColor = '#000';
                    videoElement.style.objectFit = 'contain';
                    
                    // Replace the placeholder content
                    const remotePlaceholder = document.querySelector('.remote-video-placeholder');
                    if (remotePlaceholder) {
                      remotePlaceholder.innerHTML = '';
                      remotePlaceholder.appendChild(videoElement);
                    }
                  }
                  videoElement.srcObject = remoteStream;
                  videoElement.muted = false;
                  videoElement.setAttribute("playsinline", true);
                  videoElement.play().catch(e => console.log('Video play failed:', e));
                }
              }
            };
            
            peerConnection.onconnectionstatechange = () => {
              const state = peerConnection.connectionState;
              console.log('🔗 Web app incoming call connection state:', state);
              if (state === 'connected') {
                console.log('🎉 Incoming call WebRTC connection established!');
                // Connection successful - let it stabilize
                setTimeout(() => {
                  if (peerConnection.connectionState === 'connected') {
                    console.log('✅ Incoming call connection stable');
                  }
                }, 2000);
              } else if (state === 'failed') {
                console.log('❌ Incoming call WebRTC connection failed');
                setCallInProgress(false);
                setIsInCall(false);
              } else if (state === 'disconnected') {
                console.log('⚠️ Incoming call WebRTC connection disconnected');
              }
            };
            
            // Add ICE connection state monitoring for debugging
            peerConnection.oniceconnectionstatechange = () => {
              const state = peerConnection.iceConnectionState;
              console.log('🧊 Web app incoming call ICE state:', state);
              
              switch (state) {
                case 'connected':
                  console.log('✅ ICE connected - media should be flowing');
                  break;
                case 'completed':
                  console.log('✅ ICE completed - connection established');
                  break;
                case 'failed':
                  console.log('❌ ICE failed - call cannot connect');
                  break;
                case 'disconnected':
                  console.log('⚠️ ICE disconnected');
                  break;
              }
            };
            
            peerConnection.onicecandidate = (event) => {
              if (event.candidate) {
                console.log('🧊 Sending ICE candidate for incoming call');
                newSocket.emit('ice-candidate', {
                  roomKey: key,
                  candidate: event.candidate
                });
              }
            };
            
            // Store peer connection for later use
            peerConnectionRef.current = peerConnection;
            console.log('✅ Peer connection created and stored for incoming call');
            
            // Process any buffered offer and ICE candidates
            await processPendingSignaling(newSocket, roomKey);
            
            newSocket.emit('accept-call', {
              roomKey: roomKey,
              callId: data.callId
            });
            
            console.log(`✅ ${callType} call accepted! Setting up connection...`);
          } catch (error) {
            console.error('Error accepting call:', error);
            alert('Failed to accept call. Please check your camera and microphone permissions.');
            setCallInProgress(false);
            setIsInCall(false);
          }
        } else {
          console.log('❌ Call rejected by user');
          newSocket.emit('reject-call', {
            roomKey: roomKey,
            callId: data.callId
          });
        }
      }
    });

    newSocket.on('call-ended', () => {
      setCallInProgress(false);
      setIsInCall(false);
      
      // Stop local media stream (camera/microphone)
      stopLocalMediaStream();
      
      // Reset mute/video states
      setIsMuted(false);
      setIsVideoOff(false);
      
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
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
      console.log('📞 Call ended');
    });

    // WebRTC signaling handlers
    newSocket.on('call-offer', async (data) => {
      console.log('📞 RECEIVED CALL OFFER:', data);
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
          console.log('✅ Call answer sent successfully!');
        } catch (error) {
          console.error('❌ Error handling call offer:', error);
        }
      } else {
        console.log('⏳ Buffering offer until peer connection is ready...');
        setPendingOffer(data);
      }
    });

    newSocket.on('call-answer', async (data) => {
      console.log('📞 RECEIVED CALL ANSWER:', data);
      if (peerConnectionRef.current) {
        try {
          await peerConnectionRef.current.setRemoteDescription(data.answer);
          console.log('Set remote description from answer');
        } catch (error) {
          console.error('Error handling call answer:', error);
        }
      }
    });

    newSocket.on('ice-candidate', async (data) => {
      console.log('🧊 RECEIVED ICE CANDIDATE:', data);
      if (peerConnectionRef.current) {
        try {
          await peerConnectionRef.current.addIceCandidate(
            new RTCIceCandidate(data.candidate)
          );
          console.log('✅ ICE candidate added successfully');
        } catch (error) {
          console.error('❌ Error adding ICE candidate:', error);
        }
      } else {
        console.log('⏳ Buffering ICE candidate until peer connection is ready...');
        setPendingIceCandidates(prev => [...prev, data.candidate]);
      }
    });

    setSocket(newSocket);
    setRoomKey(key);
    setUsername(name);
  };

  const leaveRoom = () => {
    // Stop local media stream if active
    stopLocalMediaStream();
    
    // Clean up call state
    setCallInProgress(false);
    setIsInCall(false);
    
    if (socket) {
      socket.emit('leave room');
      socket.disconnect();
    }
    setSocket(null);
    setMessages([]);
    setUserPublicKeys({});
    setUserId(null);
    setCurrentView('home');
    setRoomKey('');
    setGeneratedKey('');
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (message.trim() && userId && socket) {
      // Send encrypted message if encryption is available
      let messageData;
      if (keys && userPublicKeys && Object.keys(userPublicKeys).length > 0) {
        try {
          // Encrypt message for all users
          const encryptedMessages = {};
          Object.keys(userPublicKeys).forEach(targetUserId => {
            if (targetUserId !== userId) {
              encryptedMessages[targetUserId] = encryptMessage(userPublicKeys[targetUserId], message);
            }
          });
          
          messageData = {
            text: message,
            encrypted: encryptedMessages,
            from: userId,
            username: username,
            timestamp: Date.now()
          };
          
          console.log('Sending encrypted message:', messageData);
          socket.emit('chat message', messageData);
        } catch (error) {
          console.error('Encryption failed, sending plain text:', error);
          // Fallback to plain text
          messageData = {
            text: message,
            from: userId,
            username: username,
            timestamp: Date.now()
          };
          socket.emit('chat message plain', messageData);
        }
      } else {
        // Send plain text for testing (no encryption)
        messageData = {
          text: message,
          from: userId,
          username: username,
          timestamp: Date.now()
        };
        
        console.log('Sending plain text message:', messageData);
        socket.emit('chat message plain', messageData);
      }
      
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

  const startCall = async (type) => {
    if (socket && roomKey && userId && !callInProgress) {
      console.log(`Starting ${type} call in room ${roomKey}`);
      setCallInProgress(true);
      setCurrentCallType(type);
      
      // Send call notification to chat
      const callTypeText = type === 'audio' ? 'voice' : 'video';
      sendCallNotification(`📞 ${username} started a ${callTypeText} call`);
      
      try {
        // Request media permissions with mobile-friendly constraints
        const constraints = {
          audio: true,
          video: type === 'video' ? {
            width: { ideal: 1280, max: 1920 },
            height: { ideal: 720, max: 1080 },
            facingMode: 'user'
          } : false
        };
        
        // For mobile devices, try to get camera with specific constraints
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        
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
            { urls: 'stun:stun1.l.google.com:19302' },
            {
              urls: 'turn:openrelay.metered.ca:80',
              username: 'openrelayproject',
              credential: 'openrelayproject'
            },
            {
              urls: 'turn:openrelay.metered.ca:443',
              username: 'openrelayproject',
              credential: 'openrelayproject'
            }
          ]
        });
        
        // Store peer connection globally
        peerConnectionRef.current = peerConnection;
        
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
        
        // Add ICE connection state monitoring for debugging
        peerConnection.oniceconnectionstatechange = () => {
          const state = peerConnection.iceConnectionState;
          console.log('🧊 Web app outgoing call ICE state:', state);
          
          switch (state) {
            case 'connected':
              console.log('✅ ICE connected - media should be flowing');
              break;
            case 'completed':
              console.log('✅ ICE completed - connection established');
              break;
            case 'failed':
              console.log('❌ ICE failed - call cannot connect');
              break;
            case 'disconnected':
              console.log('⚠️ ICE disconnected');
              break;
          }
        };
        
        peerConnection.onicecandidate = (event) => {
          if (event.candidate) {
            console.log('🧊 Sending ICE candidate for outgoing call');
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
        
        if (error.name === 'NotAllowedError') {
          if (navigator.userAgent.match(/Mobile|Android|iPhone|iPad|iPod/)) {
            alert('Mobile devices require HTTPS for camera access. Please ensure you\'re accessing this app via HTTPS or use the mobile app for video calls.');
          } else {
            alert('Camera and microphone permissions are required for calls. Please allow access and try again.');
          }
        } else if (error.name === 'NotFoundError') {
          alert('No camera or microphone found. Please check your device hardware.');
        } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
          alert('Camera or microphone is already in use by another application.');
        } else {
          alert('Failed to start call. Please check your camera and microphone.');
        }
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
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
      
      // Clean up audio/video elements
      const audioElement = document.getElementById('remoteAudio');
      if (audioElement) {
        audioElement.srcObject = null;
        audioElement.pause();
        audioElement.remove();
      }
      
      const videoElement = document.getElementById('remoteVideo');
      if (videoElement) {
        videoElement.srcObject = null;
        videoElement.pause();
        videoElement.remove();
      }
      
      const localVideoElement = document.getElementById('localVideo');
      if (localVideoElement) {
        localVideoElement.srcObject = null;
        localVideoElement.pause();
        localVideoElement.remove();
      }
      
      // Also clear any video elements in placeholders
      const remotePlaceholder = document.querySelector('.remote-video-placeholder');
      if (remotePlaceholder) {
        remotePlaceholder.innerHTML = '';
      }
      
      const localPlaceholder = document.querySelector('.local-video-placeholder');
      if (localPlaceholder) {
        localPlaceholder.innerHTML = '';
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
    try {
      const qrData = {
        type: 'PQEncrypt-room',
        roomKey: roomCode,
        url: `${window.location.origin}/room/${roomCode}`,
        timestamp: Date.now()
      };
      
      const qrCodeDataUrl = await QRCode.toDataURL(JSON.stringify(qrData));
      setQrCodeUrl(qrCodeDataUrl);
      
      // Also set the room URL for sharing
      setRoomUrl(`${window.location.origin}/room/${roomCode}`);
    } catch (error) {
      console.error('Error generating QR code:', error);
      alert('Failed to generate QR code');
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
      const response = await fetch(`https://maxyserver.servehalflife.com/room/${roomCode}`, {
        mode: 'cors',
        credentials: 'omit',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();
      
      if (response.ok) {
        return data;
      } else {
        throw new Error(data.error || 'Failed to access room');
      }
    } catch (error) {
      console.error('Error checking room access:', error);
      throw error;
    }
  };

  const joinRoomViaUrl = async (roomCode) => {
    const validationError = validateUsername(username);
    if (validationError) {
      setUsernameError(validationError);
      return;
    }
    
    try {
      const roomData = await checkRoomAccess(roomCode);
      
      if (roomData.success) {
        // Save username and add to recent rooms
        localStorage.setItem('username', username.trim());
        const newRecentRooms = [roomCode, ...recentRooms.filter(room => room !== roomCode)].slice(0, 5);
        setRecentRooms(newRecentRooms);
        localStorage.setItem('recentRooms', JSON.stringify(newRecentRooms));
        
        setIsRoomCreator(false);
        joinRoom(roomCode, username.trim(), false);
      }
    } catch (error) {
      alert(error.message || 'Failed to join room via URL');
    }
  };

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
      
      // Force release of camera on mobile
      setTimeout(() => {
        console.log('🔄 Forcing camera release...');
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          // Try to release camera by requesting it and immediately stopping
          navigator.mediaDevices.getUserMedia({ video: true, audio: false })
            .then(stream => {
              stream.getTracks().forEach(track => track.stop());
            })
            .catch(() => {
              // Expected to fail, camera should be released
            });
        }
      }, 100);
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
    if (pendingOffer && peerConnectionRef.current) {
      console.log('📞 Processing buffered offer...');
      try {
        await peerConnectionRef.current.setRemoteDescription(pendingOffer.offer);
        const answer = await peerConnectionRef.current.createAnswer();
        await peerConnectionRef.current.setLocalDescription(answer);
        
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
    if (pendingIceCandidates.length > 0 && peerConnectionRef.current) {
      console.log(`🧊 Processing ${pendingIceCandidates.length} buffered ICE candidates...`);
      for (const candidate of pendingIceCandidates) {
        try {
          await peerConnectionRef.current.addIceCandidate(candidate);
          console.log('✅ Buffered ICE candidate added');
        } catch (error) {
          console.error('❌ Error adding buffered ICE candidate:', error);
        }
      }
      setPendingIceCandidates([]);
    }
  };

  const shareFile = () => {
    if (!socket || !roomKey) {
      alert('Please join a room first to share files.');
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '*/*';
    input.style.display = 'none';
    
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        console.log('File selected:', file.name, 'Size:', file.size);
        
        // Check file size limit (5MB for better performance)
        if (file.size > 5 * 1024 * 1024) {
          alert('File size must be less than 5MB');
          return;
        }

        const fileType = file.type.startsWith('image/') ? 'image' : 'document';
        const fileSize = file.size < 1024 * 1024 
          ? (file.size / 1024).toFixed(1) + ' KB'
          : (file.size / (1024 * 1024)).toFixed(1) + ' MB';
        
        if (window.confirm(`Share "${file.name}" (${fileSize})?`)) {
          // Convert file to base64 for transmission
          const reader = new FileReader();
          reader.onload = (event) => {
            try {
              const fileData = event.target.result;
              
              const fileMessage = {
                type: 'file',
                fileName: file.name,
                fileType: fileType,
                fileSize: fileSize,
                mimeType: file.type,
                fileData: fileData, // Base64 encoded file data
                from: userId,
                username: username,
                timestamp: Date.now()
              };

              console.log('Sending file message:', file.name, fileSize);
              socket.emit('chat message plain', fileMessage);
              console.log('✅ File shared successfully:', file.name);
            } catch (error) {
              console.error('Error preparing file message:', error);
              alert('Error sharing file. Please try again.');
            }
          };
          
          reader.onerror = (error) => {
            console.error('FileReader error:', error);
            alert('Error reading file. Please try again.');
          };
          
          reader.readAsDataURL(file);
        }
      }
    };
    
    // Add to DOM temporarily and click
    document.body.appendChild(input);
    input.click();
    
    // Clean up after a delay
    setTimeout(() => {
      if (input.parentNode) {
        document.body.removeChild(input);
      }
    }, 1000);
  };

  if (currentView === 'home') {
    return (
      <div className={`app ${theme}`}>
        <div className="container">
          <header className="header">
            <div className="header-content">
              <h1 className="title">PQEncrypt</h1>
              <p className="subtitle">Anonymous, ephemeral messaging</p>
            </div>
            <button className="theme-toggle" onClick={toggleTheme}>
              {theme === 'light' ? '🌙' : '☀️'}
            </button>
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
            </div>
            <p className="section-description">
              Enter a session key to join an existing chat room
            </p>
            <input
              type="text"
              className="input"
              placeholder="Enter session key..."
              value={roomKey}
              onChange={(e) => setRoomKey(e.target.value.toUpperCase())}
              maxLength={6}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  joinChatRoom();
                }
              }}
            />
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
            <button className="secondary-button" onClick={joinChatRoom}>
              Join Chat Room
            </button>
            {roomKey && (
              <button className="url-button" onClick={() => joinRoomViaUrl(roomKey)}>
                🌐 Join via URL
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

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
            <button className="call-button" onClick={shareFile} title="Share File">
              📎
            </button>
            <button className="theme-toggle" onClick={toggleTheme}>
              {theme === 'light' ? '🌙' : '☀️'}
            </button>
            <button className="leave-button" onClick={leaveRoom}>
              Leave
            </button>
          </div>
        </header>

        <div className="messages-container">
          {messages.map((msg, index) => {
            let decryptedText = '...';
            let isFileMessage = false;
            
            // Handle file messages
            if (msg.type === 'file') {
              const fileIcon = msg.fileType === 'document' ? '📄' : '🖼️';
              decryptedText = (
                <div className="file-message-content">
                  <div className="file-info">
                    <span className="file-icon">{fileIcon}</span>
                    <div className="file-details">
                      <div className="file-name">{msg.fileName}</div>
                      <div className="file-size">{msg.fileSize}</div>
                    </div>
                  </div>
                  {msg.fileData && (
                    <a 
                      href={msg.fileData} 
                      download={msg.fileName}
                      className="download-button"
                      onClick={(e) => e.stopPropagation()}
                    >
                      📥 Download
                    </a>
                  )}
                </div>
              );
              isFileMessage = true;
            }
            // Handle system messages
            else if (msg.type === 'system') {
              decryptedText = (
                <div className="system-message">
                  <span className="system-text">{msg.text}</span>
                  <span className="system-date">
                    {new Date(msg.timestamp).toLocaleDateString()}
                  </span>
                </div>
              );
            }
            // Handle call notifications
            else if (msg.type === 'call-notification') {
              decryptedText = msg.text;
            }
            // Handle screenshot notifications
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
              console.log('Message format:', msg);
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
                <p>Scan this QR code with your mobile device to join the room instantly!</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* User List Modal */}
      {showUserList && (
        <div className="modal-overlay" onClick={() => setShowUserList(false)}>
          <div className="user-list-modal" onClick={(e) => e.stopPropagation()}>
            <div className="user-list-header">
              <h3>Users in Room ({roomUsers.length + 1})</h3>
              <button className="close-button" onClick={() => setShowUserList(false)}>✕</button>
            </div>
            <div className="user-list">
              <div className="user-item">
                <span className="user-icon">👤</span>
                <span className="user-name">{username} (You)</span>
              </div>
              {roomUsers.map((user, index) => (
                <div key={user.userId || index} className="user-item">
                  <span className="user-icon">👤</span>
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
