import React from 'react';

export function ChatHeader({
  roomKey, username, userId, theme,
  isRoomCreator, roomLocked,
  isInCall,
  onLockToggle, onShowUsers, onStartAudioCall, onStartVideoCall,
  onEndCall, onShareFile, onToggleTheme, onLeaveRoom,
}) {
  return (
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
            onClick={onLockToggle}
            title={roomLocked ? 'Unlock Room' : 'Lock Room'}
          >
            {roomLocked ? '🔓' : '🔒'}
          </button>
        )}
        <button className="call-button" onClick={onShowUsers} title="Users">👥</button>
        {!isInCall ? (
          <>
            <button className="call-button" onClick={onStartAudioCall} title="Voice Call">📞</button>
            <button className="call-button" onClick={onStartVideoCall} title="Video Call">📹</button>
          </>
        ) : (
          <button className="call-button end-call" onClick={onEndCall} title="End Call">❌</button>
        )}
        <button className="call-button" onClick={onShareFile} title="Share File">📎</button>
        <button className="theme-toggle" onClick={onToggleTheme}>
          {theme === 'light' ? '🌙' : '☀️'}
        </button>
        <button className="leave-button" onClick={onLeaveRoom}>Leave</button>
      </div>
    </header>
  );
}
