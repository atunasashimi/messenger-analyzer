/**
 * Line Messenger TXT Export Adapter
 * Parses Line's plain text chat export format
 */

export function parseLineFormat(content, fileName) {
  const lines = content.split('\n');
  
  // Line 1: "﻿Chat history with [Name]" or "Chat history with [Name]"
  const titleLine = lines[0].replace(/^\uFEFF/, '').trim(); // Remove BOM if present
  const title = titleLine.replace('Chat history with ', '') || 'Line Conversation';
  
  // Skip metadata lines (line 1: title, line 2: saved date, line 3: empty)
  let currentDate = null;
  const messages = [];
  const participantSet = new Set();
  
  for (let i = 3; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Date header: "Fri, 16/02/2024" or similar
    const dateMatch = line.match(/^[A-Z][a-z]{2},?\s+(\d{2})\/(\d{2})\/(\d{4})$/);
    if (dateMatch) {
      const [_, day, month, year] = dateMatch;
      currentDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      continue;
    }
    
    // Message line: "23:37\tTom\tHello!" (tab-separated)
    const messageMatch = line.match(/^(\d{2}:\d{2})\t([^\t]+)\t(.+)$/);
    if (messageMatch && currentDate) {
      const [_, time, sender, text] = messageMatch;
      
      // Parse time
      const [hours, minutes] = time.split(':').map(Number);
      const timestamp = new Date(currentDate);
      timestamp.setHours(hours, minutes, 0, 0);
      
      participantSet.add(sender);
      
      // Detect message type
      const { content, type, mediaType } = normalizeLineContent(text);
      
      messages.push({
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
      });
    }
  }
  
  const participants = Array.from(participantSet);
  
  return {
    source: 'line',
    conversationId: generateId(fileName),
    title,
    participants: participants.map(name => ({
      name,
      platform: 'line',
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
 * Normalize Line message content
 * Converts Line-specific markers to standard format
 */
function normalizeLineContent(text) {
  // Check for media markers
  if (text === '[Sticker]') {
    return { content: '[Sticker]', type: 'sticker', mediaType: 'sticker' };
  }
  if (text === '[Photo]') {
    return { content: '[Photo]', type: 'media', mediaType: 'photo' };
  }
  if (text === '[Video]') {
    return { content: '[Video]', type: 'media', mediaType: 'video' };
  }
  if (text === '[Voice message]' || text === '[Audio]') {
    return { content: '[Audio]', type: 'media', mediaType: 'audio' };
  }
  if (text === '[File]') {
    return { content: '[File]', type: 'media', mediaType: 'file' };
  }
  
  // Regular text message (may contain emoji descriptions like "(moon heart eyes)")
  // We'll keep these as-is for now
  return { content: text, type: 'text', mediaType: null };
}

/**
 * Generate a unique ID from filename
 */
function generateId(fileName) {
  return fileName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
}
