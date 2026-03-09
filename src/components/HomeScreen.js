import React from 'react';

export function HomeScreen({
  theme, toggleTheme,
  username, setUsername,
  usernameError, setUsernameError,
  keys, quantumSecurity,
  generatedKey, isGeneratingKey,
  roomKey, setRoomKey,
  recentRooms,
  qrCodeUrl, showQRCode, setShowQRCode, roomUrl,
  showWelcome, setShowWelcome,
  showSecurityInfo, setShowSecurityInfo,
  onGenerateSessionKey,
  onStartChatRoom,
  onJoinChatRoom,
  onJoinRecentRoom,
  onClearRecentRooms,
  onCopyKey,
  onShowQRCode,
  onShareRoomUrl,
  onJoinViaUrl,
}) {
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

        {/* Username section */}
        <div className="section">
          <h2>Your Name</h2>
          <input
            type="text"
            className={`input ${usernameError ? 'input-error' : ''}`}
            placeholder="Enter your name..."
            value={username}
            onChange={e => { setUsername(e.target.value); setUsernameError(''); }}
            maxLength={20}
            onKeyPress={e => {
              if (e.key === 'Enter') {
                if (generatedKey) onStartChatRoom();
                else if (roomKey) onJoinChatRoom();
              }
            }}
          />
          {usernameError && <div className="error-message">{usernameError}</div>}
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

        {/* Create Room */}
        <div className="section">
          <div className="section-header">
            <span className="section-icon">🔑</span>
            <h2>Create Room</h2>
          </div>
          <p className="section-description">Generate a session key to start a new anonymous chat room</p>
          <button className="primary-button" onClick={onGenerateSessionKey} disabled={isGeneratingKey}>
            {isGeneratingKey ? '⏳ Generating...' : 'Generate Session Key'}
          </button>
          {generatedKey && (
            <>
              <div className="key-container">
                <span className="key-text">{generatedKey}</span>
                <button className="copy-button" onClick={onCopyKey}>📋</button>
                <button className="qr-button" onClick={onShowQRCode} title="Show QR Code">📱</button>
              </div>
              <button className="primary-button" onClick={onStartChatRoom}>Start Chat Room</button>
            </>
          )}
        </div>

        {/* Join Room */}
        <div className="section">
          <div className="section-header">
            <span className="section-icon">👥</span>
            <h2>Join Room</h2>
          </div>
          <p className="section-description">Enter a session key to join an existing chat room</p>
          <input
            type="text"
            className="input"
            placeholder="Enter session key..."
            value={roomKey}
            onChange={e => setRoomKey(e.target.value.toUpperCase())}
            maxLength={6}
            onKeyPress={e => { if (e.key === 'Enter') onJoinChatRoom(); }}
          />
          {recentRooms.length > 0 && (
            <div className="recent-rooms">
              <div className="recent-rooms-header">
                <span>Recent Rooms:</span>
                <button className="clear-rooms-btn" onClick={onClearRecentRooms} title="Clear">✕</button>
              </div>
              <div className="recent-rooms-list">
                {recentRooms.map((room, i) => (
                  <button key={i} className="recent-room-btn" onClick={() => onJoinRecentRoom(room)}>
                    {room}
                  </button>
                ))}
              </div>
            </div>
          )}
          <button className="secondary-button" onClick={onJoinChatRoom}>Join Chat Room</button>
          {roomKey && (
            <button className="url-button" onClick={() => onJoinViaUrl(roomKey)}>
              🌐 Join via URL
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
