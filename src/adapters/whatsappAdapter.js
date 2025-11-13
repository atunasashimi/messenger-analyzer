/**
 * WhatsApp TXT Export Adapter
 * Parses WhatsApp's plain text chat export format
 */

export function parseWhatsAppFormat(content, fileName) {
  const lines = content.split('\n');
  
  const messages = [];
  const participantSet = new Set();
  let currentMessage = null;
  
  // Regex to match WhatsApp message format:
  // "YYYY-MM-DD, HH:MM a.m./p.m. - Sender: Message"
  // or system messages: "YYYY-MM-DD, HH:MM a.m./p.m. - Message"
  const messageRegex = /^(\d{4}-\d{2}-\d{2}),\s+(\d{1,2}:\d{2}\s+(?:a\.m\.|p\.m\.))\s+-\s+([^:]+?):\s+(.*)$/;
  const systemMessageRegex = /^(\d{4}-\d{2}-\d{2}),\s+(\d{1,2}:\d{2}\s+(?:a\.m\.|p\.m\.))\s+-\s+(.*)$/;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Try to match as a regular message (with sender)
    const messageMatch = line.match(messageRegex);
    
    if (messageMatch) {
      // Save previous message if exists
      if (currentMessage) {
        messages.push(currentMessage);
      }
      
      const [_, date, time, sender, text] = messageMatch;
      
      // Parse timestamp
      const timestamp = parseWhatsAppDateTime(date, time);
      
      participantSet.add(sender);
      
      // Detect message type
      const { content, type, mediaType } = normalizeWhatsAppContent(text);
      
      currentMessage = {
        sender,
        content,
        timestamp: timestamp.getTime(),
        date: timestamp,
        type,
        metadata: {
          isUnsent: false,
          reactions: [],
          mediaType
        }
      };
    } else {
      // Check if it's a system message
      const systemMatch = line.match(systemMessageRegex);
      
      if (systemMatch) {
        // Save previous message if exists
        if (currentMessage) {
          messages.push(currentMessage);
        }
        
        // System message - we'll skip these or you can handle them differently
        currentMessage = null;
      } else if (currentMessage && line.trim()) {
        // This is a continuation of the previous message (multi-line message)
        currentMessage.content += '\n' + line;
      }
    }
  }
  
  // Don't forget to add the last message
  if (currentMessage) {
    messages.push(currentMessage);
  }
  
  const participants = Array.from(participantSet);
  
  // Generate a title from participants
  const title = participants.length === 2 
    ? `${participants[0]} & ${participants[1]}`
    : participants.length === 1 
      ? participants[0]
      : `WhatsApp Chat (${participants.length} participants)`;
  
  return {
    source: 'whatsapp',
    conversationId: generateId(fileName),
    title,
    participants: participants.map(name => ({
      name,
      platform: 'whatsapp',
      rawIdentifier: name
    })),
    messages: messages.sort((a, b) => a.timestamp - b.timestamp),
    dateRange: {
      start: messages[0]?.date || null,
      end: messages[messages.length - 1]?.date || null
    },
    totalMessages: messages.length,
    rawFileName: fileName
  };
}

/**
 * Parse WhatsApp date/time format
 * Format: "YYYY-MM-DD" and "HH:MM a.m./p.m."
 */
function parseWhatsAppDateTime(dateStr, timeStr) {
  // Parse date: "2021-06-21"
  const [year, month, day] = dateStr.split('-').map(Number);
  
  // Parse time: "4:23 a.m." or "11:45 p.m."
  const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})\s+(a\.m\.|p\.m\.)/);
  if (!timeMatch) {
    throw new Error(`Invalid time format: ${timeStr}`);
  }
  
  let [_, hours, minutes, period] = timeMatch;
  hours = parseInt(hours);
  minutes = parseInt(minutes);
  
  // Convert to 24-hour format
  if (period === 'p.m.' && hours !== 12) {
    hours += 12;
  } else if (period === 'a.m.' && hours === 12) {
    hours = 0;
  }
  
  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

/**
 * Normalize WhatsApp message content
 * Detects media attachments and other special content
 */
function normalizeWhatsAppContent(text) {
  // Check for media markers
  if (text.includes('(file attached)')) {
    // Extract filename if present
    const fileMatch = text.match(/(.+?)\s+\(file attached\)/);
    const fileName = fileMatch ? fileMatch[1] : 'File';
    
    // Determine media type from extension
    if (fileName.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
      return { content: '[Photo]', type: 'media', mediaType: 'photo' };
    } else if (fileName.match(/\.(mp4|mov|avi|mkv)$/i)) {
      return { content: '[Video]', type: 'media', mediaType: 'video' };
    } else if (fileName.match(/\.(mp3|wav|ogg|m4a|opus)$/i)) {
      return { content: '[Audio]', type: 'media', mediaType: 'audio' };
    } else if (fileName.match(/\.(pdf|doc|docx|txt)$/i)) {
      return { content: '[Document]', type: 'media', mediaType: 'document' };
    } else {
      return { content: '[File]', type: 'media', mediaType: 'file' };
    }
  }
  
  if (text === '<Media omitted>' || text === '<media omitted>') {
    return { content: '[Media]', type: 'media', mediaType: 'unknown' };
  }
  
  if (text.includes('image omitted')) {
    return { content: '[Photo]', type: 'media', mediaType: 'photo' };
  }
  
  if (text.includes('video omitted')) {
    return { content: '[Video]', type: 'media', mediaType: 'video' };
  }
  
  if (text.includes('audio omitted') || text.includes('voice message')) {
    return { content: '[Audio]', type: 'media', mediaType: 'audio' };
  }
  
  if (text.includes('sticker omitted')) {
    return { content: '[Sticker]', type: 'sticker', mediaType: 'sticker' };
  }
  
  if (text.includes('GIF omitted')) {
    return { content: '[GIF]', type: 'media', mediaType: 'gif' };
  }
  
  if (text.includes('Contact card omitted')) {
    return { content: '[Contact]', type: 'media', mediaType: 'contact' };
  }
  
  if (text.includes('Location:') || text.includes('location:')) {
    return { content: '[Location]', type: 'media', mediaType: 'location' };
  }
  
  // Regular text message
  return { content: text, type: 'text', mediaType: null };
}

/**
 * Generate a unique ID from filename
 */
function generateId(fileName) {
  return fileName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
}
