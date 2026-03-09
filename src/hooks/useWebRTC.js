import { useState, useRef, useEffect } from 'react';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
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
      if (candidate) emitWebRTC('ice-candidate', { roomKey, candidate });
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      console.log('🔗 WebRTC state:', state);
      if (state === 'failed') {
        setCallInProgress(false);
        setIsInCall(false);
      } else if (state === 'disconnected') {
        setTimeout(() => {
          if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
            setCallInProgress(false);
            setIsInCall(false);
          }
        }, 3000);
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('🧊 ICE state:', pc.iceConnectionState);
    };

    return pc;
  };

  const attachRemoteStream = (stream, callType) => {
    let audio = document.getElementById('remoteAudio');
    if (!audio) {
      audio = document.createElement('audio');
      audio.id = 'remoteAudio';
      audio.autoplay = true;
      audio.style.display = 'none';
      document.body.appendChild(audio);
    }
    audio.srcObject = stream;
    audio.muted = false;
    audio.play().catch(() => {});

    if (callType === 'video') {
      let video = document.getElementById('remoteVideo');
      if (!video) {
        video = document.createElement('video');
        video.id = 'remoteVideo';
        video.autoplay = true;
        video.style.cssText = 'width:100%;height:100%;object-fit:contain;background:#000';
        const placeholder = document.querySelector('.remote-video-placeholder');
        if (placeholder) { placeholder.innerHTML = ''; placeholder.appendChild(video); }
      }
      video.srcObject = stream;
      video.play().catch(() => {});
    }
  };

  const attachLocalStream = (stream) => {
    setTimeout(() => {
      let video = document.getElementById('localVideo');
      if (!video) {
        video = document.createElement('video');
        video.id = 'localVideo';
        video.autoplay = true;
        video.muted = true;
        video.style.cssText = 'width:100%;height:100%;object-fit:cover;transform:scaleX(-1)';
        const placeholder = document.querySelector('.local-video-placeholder');
        if (placeholder) { placeholder.innerHTML = ''; placeholder.appendChild(video); }
      }
      video.srcObject = stream;
    }, 1000);
  };

  const cleanupCallElements = () => {
    ['remoteAudio', 'remoteVideo', 'localVideo'].forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.srcObject = null; el.remove?.(); }
    });
    ['.remote-video-placeholder', '.local-video-placeholder'].forEach(sel => {
      const el = document.querySelector(sel);
      if (el) el.innerHTML = '';
    });
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

  // ── Incoming call handler (called by useSocket callback) ─────────────────
  const handleIncomingCall = async (data, roomKey) => {
    if (callInProgress) return;

    const callTypeLabel = data.callType === 'audio' ? 'Voice' : 'Video';
    const accept = window.confirm(`🔔 Incoming ${callTypeLabel} call from ${data.callerName}. Accept?`);

    if (!accept) {
      emitWebRTC('reject-call', { roomKey, callId: data.callId });
      return;
    }

    setCallInProgress(true);
    setIsInCall(true);
    setCurrentCallType(data.callType);

    try {
      const stream = await getMediaStream(data.callType);
      setLocalStream(stream);
      if (data.callType === 'video') attachLocalStream(stream);

      const pc = createPeerConnection(roomKey);
      stream.getTracks().forEach(t => pc.addTrack(t, stream));
      pc.ontrack = ({ streams }) => { if (streams?.[0]) attachRemoteStream(streams[0], data.callType); };
      peerConnectionRef.current = pc;

      await processPendingSignaling(roomKey);
      emitWebRTC('accept-call', { roomKey, callId: data.callId });
    } catch (err) {
      console.error('Accept call error:', err);
      alert('Failed to accept call. Check camera/mic permissions.');
      setCallInProgress(false);
      setIsInCall(false);
    }
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
      pc.ontrack = ({ streams }) => { if (streams?.[0]) attachRemoteStream(streams[0], callType); };
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
    formatCallDuration,
    startCall,
    endCall,
    handleIncomingCall,
    handleCallOffer,
    handleCallAnswer,
    handleIceCandidate,
    handleCallEnded,
    toggleMute,
    toggleVideo,
  };
}
