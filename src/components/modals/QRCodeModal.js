import React from 'react';

export function QRCodeModal({ qrCodeUrl, roomKey, generatedKey, onClose, onShare }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="qr-modal" onClick={e => e.stopPropagation()}>
        <div className="qr-header">
          <h3>Share Room via QR Code</h3>
          <button className="close-button" onClick={onClose}>✕</button>
        </div>
        <div className="qr-content">
          <div className="qr-code-container">
            {qrCodeUrl && <img src={qrCodeUrl} alt="Room QR Code" />}
          </div>
          <div className="room-info">
            <p className="room-key">Room: {generatedKey || roomKey}</p>
            <button className="share-button" onClick={onShare}>📋 Copy Room URL</button>
          </div>
          <div className="qr-instructions">
            <p>Scan this QR code with your mobile device to join the room instantly!</p>
          </div>
        </div>
      </div>
    </div>
  );
}
