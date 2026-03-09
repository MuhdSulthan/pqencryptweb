/**
 * useFileShare — handles file picking, base64 encoding, and sending via socket.
 */
export function useFileShare({ socket, roomKey, userId, username }) {
  const shareFile = () => {
    if (!socket || !roomKey) {
      alert('Please join a room first to share files.');
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '*/*';
    input.style.display = 'none';

    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;

      if (file.size > 5 * 1024 * 1024) {
        alert('File size must be less than 5MB');
        return;
      }

      const fileType = file.type.startsWith('image/') ? 'image' : 'document';
      const fileSize =
        file.size < 1024 * 1024
          ? (file.size / 1024).toFixed(1) + ' KB'
          : (file.size / (1024 * 1024)).toFixed(1) + ' MB';

      if (!window.confirm(`Share "${file.name}" (${fileSize})?`)) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          socket.emit('chat message plain', {
            type: 'file',
            fileName: file.name,
            fileType,
            fileSize,
            mimeType: file.type,
            fileData: event.target.result,
            from: userId,
            username,
            timestamp: Date.now(),
          });
          console.log('✅ File shared:', file.name);
        } catch (err) {
          console.error('File share error:', err);
          alert('Error sharing file. Please try again.');
        }
      };
      reader.onerror = () => alert('Error reading file. Please try again.');
      reader.readAsDataURL(file);
    };

    document.body.appendChild(input);
    input.click();
    setTimeout(() => { if (input.parentNode) input.parentNode.removeChild(input); }, 1000);
  };

  return { shareFile };
}
