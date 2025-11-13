/**
 * Facebook/Instagram JSON Export Adapter
 * Parses both Facebook Messenger and Instagram JSON formats
 */

// Helper function to decode Facebook's weird encoding
const decodeFacebookText = (text) => {
  if (!text) return text;
  try {
    // Facebook exports use Latin-1 encoding for UTF-8 characters
    return decodeURIComponent(escape(text));
  } catch {
    return text;
  }
};

/**
 * Parse JSON format and detect sub-format (Facebook vs Instagram)
 */
export function parseJSONFormat(content, fileName) {
  const data = JSON.parse(content);
  
  // Detect sub-format based on message structure
  const firstMessage = data.messages?.[0];
  if (!firstMessage) {
    throw new Error('No messages found in JSON file');
  }
  
  const isInstagram = firstMessage.hasOwnProperty('senderName');
  const isFacebook = firstMessage.hasOwnProperty('sender_name');
  
  if (isInstagram) {
    return parseInstagramJSON(data, fileName);
  } else if (isFacebook) {
    return parseFacebookJSON(data, fileName);
  }
  
  throw new Error('Unknown JSON format - not Facebook or Instagram');
}

/**
 * Parse Instagram JSON format
 */
function parseInstagramJSON(data, fileName) {
  const participants = (data.participants || []).map(name => ({
    name: name,
    platform: 'instagram',
    rawIdentifier: name
  }));
  
  const messages = data.messages
    .filter(msg => {
      // Filter out unsent messages and messages without content
      return !msg.isUnsent && (msg.text || msg.media?.length > 0);
    })
    .map(msg => {
      let content = '';
      let type = 'text';
      let mediaType = null;
      
      if (msg.text) {
        content = msg.text;
        type = 'text';
      } else if (msg.media && msg.media.length > 0) {
        content = '[Media]';
        type = 'media';
        mediaType = 'unknown';
      }
      
      return {
        sender: msg.senderName,
        content,
        timestamp: msg.timestamp,
        date: new Date(msg.timestamp),
        type,
        metadata: {
          isUnsent: msg.isUnsent,
          reactions: msg.reactions || [],
          mediaType
        }
      };
    })
    .filter(msg => msg.timestamp && msg.sender && msg.content)
    .sort((a, b) => a.timestamp - b.timestamp);
  
  return {
    source: 'instagram',
    conversationId: data.threadName || generateId(fileName),
    title: data.threadName || participants.map(p => p.name).join(', '),
    participants,
    messages,
    dateRange: {
      start: messages[0]?.date || null,
      end: messages[messages.length - 1]?.date || null
    },
    totalMessages: messages.length,
    rawFileName: fileName
  };
}

/**
 * Parse Facebook Messenger JSON format
 */
function parseFacebookJSON(data, fileName) {
  const participants = (data.participants || []).map(p => ({
    name: decodeFacebookText(p.name),
    platform: 'facebook',
    rawIdentifier: p.name
  }));
  
  const messages = data.messages
    .filter(msg => {
      // Filter out messages without content
      return msg.content || msg.photos || msg.videos || msg.audio_files || msg.files;
    })
    .map(msg => {
      let content = '';
      let type = 'text';
      let mediaType = null;
      
      if (msg.content) {
        content = decodeFacebookText(msg.content);
        type = 'text';
      } else if (msg.photos) {
        content = '[Photo]';
        type = 'media';
        mediaType = 'photo';
      } else if (msg.videos) {
        content = '[Video]';
        type = 'media';
        mediaType = 'video';
      } else if (msg.audio_files) {
        content = '[Audio]';
        type = 'media';
        mediaType = 'audio';
      } else if (msg.files) {
        content = '[File]';
        type = 'media';
        mediaType = 'file';
      } else if (msg.share) {
        content = '[Shared link]';
        type = 'media';
        mediaType = 'link';
      } else {
        content = '[Media]';
        type = 'media';
        mediaType = 'unknown';
      }
      
      return {
        sender: decodeFacebookText(msg.sender_name),
        content,
        timestamp: msg.timestamp_ms,
        date: new Date(msg.timestamp_ms),
        type,
        metadata: {
          isUnsent: false,
          reactions: msg.reactions || [],
          mediaType
        }
      };
    })
    .filter(msg => msg.timestamp && msg.sender && msg.content)
    .sort((a, b) => a.timestamp - b.timestamp);
  
  return {
    source: 'facebook',
    conversationId: generateId(fileName),
    title: decodeFacebookText(data.title) || participants.map(p => p.name).join(', '),
    participants,
    messages,
    dateRange: {
      start: messages[0]?.date || null,
      end: messages[messages.length - 1]?.date || null
    },
    totalMessages: messages.length,
    rawFileName: fileName
  };
}

/**
 * Generate a unique ID from filename
 */
function generateId(fileName) {
  return fileName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
}
