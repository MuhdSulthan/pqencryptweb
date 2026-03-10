import { useState, useRef, useEffect } from 'react';

const ICE_SERVERS = {
  iceServers: [
    // STUN — discover public IP
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    // TURN — relay for symmetric NAT (openrelay)
    { urls: 'turn:openrelay.metered.ca:80',  username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turns:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
    // TURN — freestun (no account needed)
    { urls: 'turn:freestun.net:3478',  username: 'free', credential: 'free' },
    { urls: 'turns:freestun.net:5349', username: 'free', credential: 'free' },
  ],
};

export function useWebRTC({ emitWebRTC, sendCallNotification }) {
  const [isInCall, setIsInCall] = useState(false);
  const [callInProgress, setCallInProgress] = useState(false);
  const [currentCallType, setCurrentCallType] = useState('audio');
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);

  const peerConnectionRef = useRef(null);
  const pendingOfferRef = useRef(null);
  const pendingIceCandidatesRef = useRef([]);
  const callTimerRef = useRef(null);

  // Call duration timer
  useEffect(() => {
    if (isInCall) {
      callTimerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);
    } else {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
      setCallDuration(0);
    }
    return () => clearInterval(callTimerRef.current);
  }, [isInCall]);

  const formatCallDuration = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const stopLocalMediaStream = (stream) => {
    const s = stream || localStream;
    if (s) {
      s.getTracks().forEach(t => t.stop());
      setLocalStream(null);
    }
  };

  const getMediaStream = async (callType) => {
    return navigator.mediaDevices.getUserMedia({
      audio: true,
      video: callType === 'video'
        ? { width: { ideal: 1280, max: 1920 }, height: { ideal: 720, max: 1080 }, facingMode: 'user' }
        : false,
    });
  };

  const createPeerConnection = (roomKey) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        console.log('📡 Sending ICE candidate:', candidate.type, candidate.protocol, candidate.address);
        emitWebRTC('ice-candidate', { roomKey, candidate });
      } else {
        console.log('✅ ICE gathering complete');
      }
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      console.log('🔗 WebRTC connection state:', state);
      if (state === 'connected') {
        console.log('✅ Peers connected! Media should be flowing.');
      } else if (state === 'failed') {
        console.error('❌ WebRTC connection FAILED — ICE could not find a path between peers.');
        alert('Call connection failed. This may be due to a firewall or NAT. Please try again.');
        setCallInProgress(false);
        setIsInCall(false);
        setRemoteStream(null);
      } else if (state === 'disconnected') {
        setTimeout(() => {
          if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
            setCallInProgress(false);
            setIsInCall(false);
            setRemoteStream(null);
          }
        }, 3000);
      }
    };

    pc.onicegatheringstatechange = () => {
      console.log('🧊 ICE gathering state:', pc.iceGatheringState);
    };

    pc.oniceconnectionstatechange = () => {
      console.log('🔀 ICE connection state:', pc.iceConnectionState);
    };

    pc.ontrack = ({ streams, track }) => {
      console.log('🎵 ontrack fired — track kind:', track.kind, '| streams:', streams.length);
    };

    return pc;
  };

  // Store remote stream in state so React renders the media elements
  const attachRemoteStream = (stream) => {
    setRemoteStream(stream);
  };

  // Store local stream (already in state — just expose srcObject to video element)
  const attachLocalStream = (_stream) => {
    // localStream state is already set; CallOverlay reads it via props
  };

  const cleanupCallElements = () => {
    setRemoteStream(null);
  };

  const processPendingSignaling = async (roomKey) => {
    const pc = peerConnectionRef.current;
    if (!pc) return;

    if (pendingOfferRef.current) {
      try {
        await pc.setRemoteDescription(pendingOfferRef.current.offer);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        emitWebRTC('call-answer', { roomKey, answer });
        pendingOfferRef.current = null;
      } catch (err) {
        console.error('Error processing buffered offer:', err);
      }
    }

    for (const candidate of pendingIceCandidatesRef.current) {
      try { await pc.addIceCandidate(candidate); } catch (_) {}
    }
    pendingIceCandidatesRef.current = [];
  };

  // ── Incoming call: Phase 1 — store pending call, show UI (no confirm!) ─────
  const handleIncomingCall = (data, roomKey) => {
    if (callInProgress) return; // ignore if already in a call
    setIncomingCall({
      callerName: data.callerName,
      callType: data.callType,
      callId: data.callId,
      roomKey,
    });
  };

  // ── Incoming call: Phase 2a — user clicked Accept button (user gesture!) ───
  const acceptCall = async () => {
    if (!incomingCall) return;
    const { callType, callId, roomKey } = incomingCall;
    setIncomingCall(null);
    setCallInProgress(true);
    setIsInCall(true);
    setCurrentCallType(callType);

    try {
      const stream = await getMediaStream(callType);
      setLocalStream(stream);
      if (callType === 'video') attachLocalStream(stream);

      const pc = createPeerConnection(roomKey);
      stream.getTracks().forEach(t => pc.addTrack(t, stream));
      pc.ontrack = ({ streams }) => { if (streams?.[0]) attachRemoteStream(streams[0]); };
      peerConnectionRef.current = pc;

      await processPendingSignaling(roomKey);
      emitWebRTC('accept-call', { roomKey, callId });
    } catch (err) {
      console.error('Accept call error:', err);
      if (err.name === 'NotAllowedError') {
        alert('Camera/microphone permission was denied. Please allow access in your browser settings and try again.');
      } else {
        alert('Failed to accept call. Please check your camera and microphone.');
      }
      setCallInProgress(false);
      setIsInCall(false);
    }
  };

  // ── Incoming call: Phase 2b — user clicked Decline button ─────────────────
  const declineCall = () => {
    if (!incomingCall) return;
    emitWebRTC('reject-call', { roomKey: incomingCall.roomKey, callId: incomingCall.callId });
    setIncomingCall(null);
  };

  // ── Outgoing call ─────────────────────────────────────────────────────────
  const startCall = async ({ callType, roomKey, userId, username }) => {
    if (callInProgress) { alert('A call is already in progress.'); return; }
    if (!roomKey || !userId) { alert('Unable to start call. Please make sure you are connected to the room.'); return; }

    setCallInProgress(true);
    setCurrentCallType(callType);
    sendCallNotification(`📞 ${username} started a ${callType === 'audio' ? 'voice' : 'video'} call`);

    try {
      const stream = await getMediaStream(callType);
      setLocalStream(stream);
      if (callType === 'video') attachLocalStream(stream);

      const pc = createPeerConnection(roomKey);
      stream.getTracks().forEach(t => pc.addTrack(t, stream));
      pc.ontrack = ({ streams }) => { if (streams?.[0]) attachRemoteStream(streams[0]); };
      peerConnectionRef.current = pc;

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      emitWebRTC('call-offer', { roomKey, offer, callType, callerName: username });
      emitWebRTC('call-user', { roomKey, callType, from: userId, username });

      setIsInCall(true);
    } catch (err) {
      console.error('Start call error:', err);
      setCallInProgress(false);
      if (err.name === 'NotAllowedError') {
        alert('Camera and microphone permissions are required for calls. Please allow access and try again.');
      } else if (err.name === 'NotFoundError') {
        alert('No camera or microphone found. Please check your device hardware.');
      } else {
        alert('Failed to start call. Please check your camera and microphone.');
      }
    }
  };

  // ── End call ─────────────────────────────────────────────────────────────
  const endCall = ({ roomKey, username }) => {
    emitWebRTC('end-call', { roomKey });
    setCallInProgress(false);
    setIsInCall(false);
    setIsMuted(false);
    setIsVideoOff(false);

    stopLocalMediaStream();
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;
    cleanupCallElements();
    pendingOfferRef.current = null;
    pendingIceCandidatesRef.current = [];
    sendCallNotification(`📞 ${username} ended the call`);
  };

  // ── Call ended by remote ──────────────────────────────────────────────────
  const handleCallEnded = () => {
    setCallInProgress(false);
    setIsInCall(false);
    setIsMuted(false);
    setIsVideoOff(false);
    stopLocalMediaStream();
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;
    cleanupCallElements();
    pendingOfferRef.current = null;
    pendingIceCandidatesRef.current = [];
    console.log('📞 Remote ended call');
  };

  // ── Signaling handlers (registered as socket callbacks) ───────────────────
  const handleCallOffer = async (data) => {
    if (peerConnectionRef.current) {
      try {
        await peerConnectionRef.current.setRemoteDescription(data.offer);
        const answer = await peerConnectionRef.current.createAnswer();
        await peerConnectionRef.current.setLocalDescription(answer);
        emitWebRTC('call-answer', { answer });
      } catch (err) { console.error('Call offer error:', err); }
    } else {
      pendingOfferRef.current = data;
    }
  };

  const handleCallAnswer = async (data) => {
    try {
      await peerConnectionRef.current?.setRemoteDescription(data.answer);
    } catch (err) { console.error('Call answer error:', err); }
  };

  const handleIceCandidate = async (data) => {
    if (peerConnectionRef.current) {
      try { await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate)); }
      catch (err) { console.error('ICE candidate error:', err); }
    } else {
      pendingIceCandidatesRef.current.push(data.candidate);
    }
  };

  const toggleMute = () => {
    if (localStream) {
      const audio = localStream.getAudioTracks()[0];
      if (audio) { audio.enabled = !audio.enabled; setIsMuted(!audio.enabled); }
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      const video = localStream.getVideoTracks()[0];
      if (video) { video.enabled = !video.enabled; setIsVideoOff(!video.enabled); }
    }
  };

  return {
    isInCall,
    callInProgress,
    currentCallType,
    callDuration,
    isMuted,
    isVideoOff,
    localStream,
    remoteStream,
    incomingCall,
    formatCallDuration,
    startCall,
    endCall,
    handleIncomingCall,
    acceptCall,
    declineCall,
    handleCallOffer,
    handleCallAnswer,
    handleIceCandidate,
    handleCallEnded,
    toggleMute,
    toggleVideo,
  };
}
