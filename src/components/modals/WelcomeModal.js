import React from 'react';

export function WelcomeModal({ onDismiss }) {
  return (
    <div className="modal-overlay" onClick={onDismiss}>
      <div className="welcome-modal" onClick={e => e.stopPropagation()}>
        <div className="welcome-header">
          <h2>🎉 Welcome to PQEncrypt!</h2>
          <button className="close-button" onClick={onDismiss}>✕</button>
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
            <h3>📞 Voice &amp; Video Calls</h3>
            <p>Make secure calls directly in your browser. No downloads needed.</p>
          </div>
          <div className="welcome-section">
            <h3>💾 Your Preferences</h3>
            <p>We'll remember your username and recent rooms for convenience.</p>
          </div>
        </div>
        <div className="welcome-actions">
          <button className="primary-button" onClick={onDismiss}>Get Started!</button>
        </div>
      </div>
    </div>
  );
}
