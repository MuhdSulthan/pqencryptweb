import React from 'react';

export function CallOverlay({
  currentCallType, callDuration, callInProgress, roomKey,
  isMuted, isVideoOff,
  formatCallDuration, onEndCall, onToggleMute, onToggleVideo,
}) {
  return (
    <div className="call-overlay">
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
              <div className="remote-video-placeholder" />
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
              {isVideoOff ? '📹' : '📷'}
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
