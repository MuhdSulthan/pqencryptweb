import React, { useRef, useEffect } from 'react';

/**
 * CallOverlay — renders the in-call UI.
 * Attaches localStream / remoteStream to <video>/<audio> elements via refs
 * so the browser autoPlay policy is satisfied (srcObject assignment + React's
 * own autoPlay attribute are both used for maximum compatibility).
 */
export function CallOverlay({
  currentCallType, callDuration, callInProgress, roomKey,
  isMuted, isVideoOff,
  localStream, remoteStream,
  formatCallDuration, onEndCall, onToggleMute, onToggleVideo,
}) {
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const localVideoRef  = useRef(null);

  // Attach remote stream to audio (always) and video (video calls only)
  useEffect(() => {
    if (remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
    }
    if (remoteVideoRef.current && remoteStream && currentCallType === 'video') {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, currentCallType]);

  // Attach local stream to local video preview
  useEffect(() => {
    if (localVideoRef.current && localStream && currentCallType === 'video') {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, currentCallType]);

  return (
    <div className="call-overlay">
      {/* Hidden audio element — always present for voice/video calls */}
      <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: 'none' }} />

      <div className="call-interface">
        <div className="call-header">
          <div className="call-info">
            <h2 className="call-title">
              {currentCallType === 'video' ? '📹 Video Call' : '📞 Voice Call'}
            </h2>
            <p className="call-duration">{formatCallDuration(callDuration)}</p>
            <p className="call-status">{callInProgress ? 'Connected' : 'Connecting...'}</p>
          </div>
        </div>

        <div className="call-content">
          {currentCallType === 'video' ? (
            <div className="video-container">
              {/* Remote video */}
              <div className="remote-video-placeholder">
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000' }}
                />
              </div>
              {/* Local video preview */}
              <div className="local-video-placeholder">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
                />
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
            onClick={onToggleMute}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? '🔇' : '🎤'}
          </button>
          {currentCallType === 'video' && (
            <button
              className={`call-control-btn video-btn ${isVideoOff ? 'video-off' : ''}`}
              onClick={onToggleVideo}
              title={isVideoOff ? 'Turn Camera On' : 'Turn Camera Off'}
            >
              {isVideoOff ? '📷' : '📹'}
            </button>
          )}
          <button className="call-control-btn end-call-btn" onClick={onEndCall} title="End Call">
            📞
          </button>
        </div>
      </div>
    </div>
  );
}
