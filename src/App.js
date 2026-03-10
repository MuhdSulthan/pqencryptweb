// src/App.js — Orchestrator
import React, { useState, useEffect } from 'react';
import './App.css';

// Hooks
import { useTheme }       from './hooks/useTheme';
import { useEncryption }  from './hooks/useEncryption';
import { useRoomManager } from './hooks/useRoomManager';
import { useSocket }      from './hooks/useSocket';
import { useWebRTC }      from './hooks/useWebRTC';
import { useFileShare }   from './hooks/useFileShare';

// Components
import { HomeScreen }   from './components/HomeScreen';
import { ChatHeader }   from './components/ChatHeader';
import { MessageList }  from './components/MessageList';
import { CallOverlay }  from './components/CallOverlay';

// Modals
import { WelcomeModal }      from './components/modals/WelcomeModal';
import { QRCodeModal }       from './components/modals/QRCodeModal';
import { SecurityModal }     from './components/modals/SecurityModal';
import { UserListModal }     from './components/modals/UserListModal';
import { IncomingCallModal } from './components/modals/IncomingCallModal';

function App() {
  const [currentView, setCurrentView] = useState('home');
  const [username, setUsername] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [roomKey, setRoomKey] = useState('');
  const [showWelcome, setShowWelcome] = useState(false);
  const [showSecurityInfo, setShowSecurityInfo] = useState(false);
  const [showUserList, setShowUserList] = useState(false);
  const [message, setMessage] = useState('');

  // ── Hooks ──────────────────────────────────────────────────────────────────
  const { theme, toggleTheme } = useTheme();

  const { keys, quantumSecurity, exportPublicKey, importPublicKey, encryptMessage, decryptMessage } =
    useEncryption();

  const {
    generatedKey, setGeneratedKey,
    recentRooms, isGeneratingKey,
    qrCodeUrl, roomUrl, showQRCode, setShowQRCode,
    validateUsername, generateSessionKey, addToRecentRooms,
    clearRecentRooms, generateQRCode,
    copyKeyToClipboard, shareRoomUrl,
  } = useRoomManager();

  // WebRTC (needs emitWebRTC, which comes from socket — wired below via callbacks)
  const webRTCEmitRef = React.useRef(null);
  const sendCallNotificationRef = React.useRef(null);

  const {
    isInCall, callInProgress, currentCallType, callDuration,
    isMuted, isVideoOff,
    localStream, remoteStream,
    incomingCall,
    formatCallDuration, startCall, endCall,
    acceptCall, declineCall,
    handleIncomingCall, handleCallOffer, handleCallAnswer,
    handleIceCandidate, handleCallEnded,
    toggleMute, toggleVideo,
  } = useWebRTC({
    emitWebRTC: (event, data) => webRTCEmitRef.current?.(event, data),
    sendCallNotification: (text) => sendCallNotificationRef.current?.(text),
  });

  const {
    socket,
    userId, messages, roomUsers, userPublicKeys,
    roomLocked, isRoomCreator,
    joinRoom, leaveRoom, sendMessage,
    sendCallNotification, lockRoom, unlockRoom, emitWebRTC,
  } = useSocket({ keys, exportPublicKey, importPublicKey });

  // Wire cross-hook references after both hooks exist
  useEffect(() => {
    webRTCEmitRef.current = emitWebRTC;
    sendCallNotificationRef.current = sendCallNotification;
  }, [emitWebRTC, sendCallNotification]);

  const { shareFile } = useFileShare({ socket, roomKey, userId, username });

  // First-visit welcome modal
  useEffect(() => {
    const saved = localStorage.getItem('username') || '';
    setUsername(saved);
    if (!localStorage.getItem('hasVisited')) {
      setShowWelcome(true);
      localStorage.setItem('hasVisited', 'true');
    }
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleStartChatRoom = () => {
    const err = validateUsername(username);
    if (err) { setUsernameError(err); return; }
    if (!generatedKey) { alert('Please generate a session key'); return; }
    if (!keys) { alert('Quantum encryption keys are still loading. Please wait.'); return; }
    localStorage.setItem('username', username.trim());
    addToRecentRooms(generatedKey);
    generateQRCode(generatedKey);
    joinRoom({
      key: generatedKey,
      name: username.trim(),
      isCreator: true,
      decryptMessage,
      onIncomingCall: (data) => handleIncomingCall(data, generatedKey),
      onCallOffer: handleCallOffer,
      onCallAnswer: handleCallAnswer,
      onIceCandidate: handleIceCandidate,
      onCallEnded: handleCallEnded,
    });
    setRoomKey(generatedKey); // ← sync App state so header and file share see the key
    setCurrentView('chat');
  };

  const handleJoinChatRoom = () => {
    const err = validateUsername(username);
    if (err) { setUsernameError(err); return; }
    if (!roomKey.trim()) { alert('Please enter a session key'); return; }
    if (!keys) { alert('Quantum encryption keys are still loading. Please wait.'); return; }
    const key = roomKey.toUpperCase();
    localStorage.setItem('username', username.trim());
    addToRecentRooms(key);
    joinRoom({
      key,
      name: username.trim(),
      isCreator: false,
      decryptMessage,
      onIncomingCall: (data) => handleIncomingCall(data, key),
      onCallOffer: handleCallOffer,
      onCallAnswer: handleCallAnswer,
      onIceCandidate: handleIceCandidate,
      onCallEnded: handleCallEnded,
    });
    setCurrentView('chat');
  };

  const handleJoinViaUrl = (roomCode) => {
    const err = validateUsername(username);
    if (err) { setUsernameError(err); return; }
    if (!roomCode) { alert('No room code provided.'); return; }
    if (!keys) { alert('Quantum encryption keys are still loading. Please wait.'); return; }
    const key = roomCode.toUpperCase();
    localStorage.setItem('username', username.trim());
    addToRecentRooms(key);
    joinRoom({
      key, name: username.trim(), isCreator: false,
      decryptMessage,
      onIncomingCall: (d) => handleIncomingCall(d, key),
      onCallOffer: handleCallOffer, onCallAnswer: handleCallAnswer,
      onIceCandidate: handleIceCandidate, onCallEnded: handleCallEnded,
    });
    setRoomKey(key);
    setCurrentView('chat');
  };

  const handleLeaveRoom = () => {
    leaveRoom();
    setCurrentView('home');
    setRoomKey('');
    setGeneratedKey('');
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    const sent = await sendMessage({ message, userId, username, keys, userPublicKeys, encryptMessage });
    if (sent) setMessage('');
  };

  const handleEndCall = () => endCall({ roomKey, username });

  const handleJoinRecentRoom = (code) => {
    setRoomKey(code);
    setTimeout(() => document.querySelector('.secondary-button')?.focus(), 100);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  if (currentView === 'home') {
    return (
      <>
        <HomeScreen
          theme={theme} toggleTheme={toggleTheme}
          username={username} setUsername={setUsername}
          usernameError={usernameError} setUsernameError={setUsernameError}
          keys={keys} quantumSecurity={quantumSecurity}
          generatedKey={generatedKey} isGeneratingKey={isGeneratingKey}
          roomKey={roomKey} setRoomKey={setRoomKey}
          recentRooms={recentRooms}
          qrCodeUrl={qrCodeUrl} showQRCode={showQRCode} setShowQRCode={setShowQRCode}
          roomUrl={roomUrl}
          showWelcome={showWelcome} setShowWelcome={setShowWelcome}
          showSecurityInfo={showSecurityInfo} setShowSecurityInfo={setShowSecurityInfo}
          onGenerateSessionKey={generateSessionKey}
          onStartChatRoom={handleStartChatRoom}
          onJoinChatRoom={handleJoinChatRoom}
          onJoinRecentRoom={handleJoinRecentRoom}
          onClearRecentRooms={clearRecentRooms}
          onCopyKey={copyKeyToClipboard}
          onShowQRCode={() => { generateQRCode(generatedKey); setShowQRCode(true); }}
          onShareRoomUrl={shareRoomUrl}
          onJoinViaUrl={handleJoinViaUrl}
        />
        {showWelcome && <WelcomeModal onDismiss={() => setShowWelcome(false)} />}
        {showQRCode && (
          <QRCodeModal
            qrCodeUrl={qrCodeUrl} roomKey={roomKey} generatedKey={generatedKey}
            onClose={() => setShowQRCode(false)} onShare={shareRoomUrl}
          />
        )}
        {showSecurityInfo && (
          <SecurityModal quantumSecurity={quantumSecurity} onClose={() => setShowSecurityInfo(false)} />
        )}
      </>
    );
  }

  return (
    <div className={`app ${theme}`}>
      {showWelcome && <WelcomeModal onDismiss={() => setShowWelcome(false)} />}

      <div className="chat-container">
        <ChatHeader
          roomKey={roomKey} username={username} userId={userId} theme={theme}
          isRoomCreator={isRoomCreator} roomLocked={roomLocked} isInCall={isInCall}
          onLockToggle={() => roomLocked ? unlockRoom(roomKey) : lockRoom(roomKey)}
          onShowUsers={() => setShowUserList(true)}
          onStartAudioCall={() => startCall({ callType: 'audio', roomKey, userId, username })}
          onStartVideoCall={() => startCall({ callType: 'video', roomKey, userId, username })}
          onEndCall={handleEndCall}
          onShareFile={shareFile}
          onToggleTheme={toggleTheme}
          onLeaveRoom={handleLeaveRoom}
        />

        <MessageList
          messages={messages}
          userId={userId}
          keys={keys}
          decryptMessage={decryptMessage}
        />

        <form className="message-form" onSubmit={handleSendMessage}>
          <input
            type="text"
            className="message-input"
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Type your message..."
          />
          <button type="submit" className="send-button">Send</button>
        </form>
      </div>

      {isInCall && (
        <CallOverlay
          currentCallType={currentCallType} callDuration={callDuration}
          callInProgress={callInProgress} roomKey={roomKey}
          isMuted={isMuted} isVideoOff={isVideoOff}
          localStream={localStream} remoteStream={remoteStream}
          formatCallDuration={formatCallDuration}
          onEndCall={handleEndCall}
          onToggleMute={toggleMute}
          onToggleVideo={toggleVideo}
        />
      )}

      {incomingCall && (
        <IncomingCallModal
          callerName={incomingCall.callerName}
          callType={incomingCall.callType}
          onAccept={acceptCall}
          onDecline={declineCall}
        />
      )}

      {showQRCode && (
        <QRCodeModal
          qrCodeUrl={qrCodeUrl} roomKey={roomKey} generatedKey={generatedKey}
          onClose={() => setShowQRCode(false)} onShare={shareRoomUrl}
        />
      )}
      {showSecurityInfo && (
        <SecurityModal quantumSecurity={quantumSecurity} onClose={() => setShowSecurityInfo(false)} />
      )}
      {showUserList && (
        <UserListModal
          username={username} roomUsers={roomUsers}
          onClose={() => setShowUserList(false)}
        />
      )}
    </div>
  );
}

export default App;
