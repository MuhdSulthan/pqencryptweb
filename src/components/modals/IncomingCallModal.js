import React from 'react';

export function IncomingCallModal({ callerName, callType, onAccept, onDecline }) {
  const callLabel = callType === 'video' ? 'Video' : 'Voice';
  const callIcon  = callType === 'video' ? '📹' : '📞';

  return (
    <div className="modal-overlay">
      <div className="incoming-call-modal" onClick={e => e.stopPropagation()}>
        <div className="incoming-call-icon">{callIcon}</div>
        <h3 className="incoming-call-title">Incoming {callLabel} Call</h3>
        <p className="incoming-call-caller">from <strong>{callerName}</strong></p>
        <div className="incoming-call-actions">
          <button className="decline-call-btn" onClick={onDecline}>
            📵 Decline
          </button>
          <button className="accept-call-btn" onClick={onAccept}>
            {callIcon} Accept
          </button>
        </div>
      </div>
    </div>
  );
}
