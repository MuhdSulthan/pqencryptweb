import React from 'react';

export function UserListModal({ username, roomUsers, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="user-list-modal" onClick={e => e.stopPropagation()}>
        <div className="user-list-header">
          <h3>Users in Room ({roomUsers.length + 1})</h3>
          <button className="close-button" onClick={onClose}>✕</button>
        </div>
        <div className="user-list">
          <div className="user-item">
            <span className="user-icon">👤</span>
            <span className="user-name">{username} (You)</span>
          </div>
          {roomUsers.map((user, index) => (
            <div key={user.userId || index} className="user-item">
              <span className="user-icon">👤</span>
              <span className="user-name">{user.username}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
