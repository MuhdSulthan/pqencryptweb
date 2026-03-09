import React from 'react';

function FileMessageContent({ msg }) {
  const fileIcon = msg.fileType === 'document' ? '📄' : '🖼️';
  return (
    <div className="file-message-content">
      <div className="file-info">
        <span className="file-icon">{fileIcon}</span>
        <div className="file-details">
          <div className="file-name">{msg.fileName}</div>
          <div className="file-size">{msg.fileSize}</div>
        </div>
      </div>
      {msg.fileData && (
        <a href={msg.fileData} download={msg.fileName} className="download-button" onClick={e => e.stopPropagation()}>
          📥 Download
        </a>
      )}
    </div>
  );
}

function SystemMessageContent({ msg }) {
  return (
    <div className="system-message">
      <span className="system-text">{msg.text}</span>
      <span className="system-date">{new Date(msg.timestamp).toLocaleDateString()}</span>
    </div>
  );
}

function resolveMessageContent(msg, userId, keys, decryptMessage) {
  if (msg.type === 'file')                 return { content: <FileMessageContent msg={msg} />, isFile: true };
  if (msg.type === 'system')               return { content: <SystemMessageContent msg={msg} />, isFile: false };
  if (msg.type === 'call-notification')    return { content: msg.text, isFile: false };
  if (msg.type === 'screenshot-notification') return { content: msg.text, isFile: false };
  if (msg.text)                            return { content: msg.text, isFile: false };
  if (msg[userId] && keys) {
    try {
      return { content: decryptMessage(keys.privateKey, msg[userId]), isFile: false };
    } catch {
      return { content: 'Failed to decrypt message.', isFile: false };
    }
  }
  return { content: msg.text || 'Message could not be displayed', isFile: false };
}

export function MessageList({ messages, userId, keys, decryptMessage }) {
  return (
    <div className="messages-container">
      {messages.map((msg, index) => {
        const { content, isFile } = resolveMessageContent(msg, userId, keys, decryptMessage);
        const align =
          msg.type === 'call-notification'        ? 'call-notification-message' :
          msg.type === 'screenshot-notification'  ? 'screenshot-notification-message' :
          msg.type === 'system'                   ? 'system-message-wrapper' :
          msg.from === userId                     ? 'my-message' : 'other-message';

        return (
          <div key={index} className={`message ${align} ${isFile ? 'file-message' : ''}`}>
            {msg.from !== userId && (
              <div className="message-username">{msg.username || 'Anonymous'}</div>
            )}
            <div className="message-text">{content}</div>
          </div>
        );
      })}
    </div>
  );
}
