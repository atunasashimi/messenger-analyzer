/**
 * Universal Conversation Format Adapter
 * Auto-detects format and routes to appropriate parser
 */

import { parseLineFormat } from './lineAdapter';
import { parseJSONFormat } from './jsonAdapter';

/**
 * Detect the format of a conversation file
 */
export function detectFormat(file, content) {
  const fileName = file.name.toLowerCase();
  
  // Check by extension first
  if (fileName.endsWith('.json')) {
    return 'json';
  }
  
  if (fileName.endsWith('.txt')) {
    // Check if it's a Line export
    const firstLine = content.split('\n')[0];
    if (firstLine.includes('Chat history with') || firstLine.includes('﻿Chat history with')) {
      return 'line';
    }
    // Could add more TXT format detection here (WhatsApp, etc.)
    return 'unknown-txt';
  }
  
  // Fallback: peek at content
  const trimmedContent = content.trim();
  
  // JSON format
  if (trimmedContent.startsWith('{') || trimmedContent.startsWith('[')) {
    return 'json';
  }
  
  // Line format
  if (trimmedContent.includes('Chat history with')) {
    return 'line';
  }
  
  return 'unknown';
}

/**
 * Parse a conversation file using the appropriate adapter
 * Returns a normalized conversation object
 */
export async function parseConversation(file) {
  try {
    const content = await file.text();
    const format = detectFormat(file, content);
    
    console.log(`Detected format: ${format} for file: ${file.name}`);
    
    switch (format) {
      case 'json':
        return parseJSONFormat(content, file.name);
      
      case 'line':
        return parseLineFormat(content, file.name);
      
      case 'unknown-txt':
        throw new Error(`Text file format not recognized. Currently supported: Line Messenger`);
      
      case 'unknown':
        throw new Error(`File format not recognized. Supported: JSON (Facebook/Instagram), TXT (Line Messenger)`);
      
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  } catch (error) {
    console.error(`Error parsing ${file.name}:`, error);
    throw new Error(`Failed to parse ${file.name}: ${error.message}`);
  }
}

/**
 * Parse multiple conversation files
 * Returns array of normalized conversation objects
 */
export async function parseConversations(files) {
  const results = [];
  const errors = [];
  
  for (const file of files) {
    try {
      const conversation = await parseConversation(file);
      results.push(conversation);
    } catch (error) {
      errors.push({
        fileName: file.name,
        error: error.message
      });
    }
  }
  
  return { conversations: results, errors };
}

/**
 * Get all unique participants across all conversations
 * Useful for identity mapping UI
 */
export function extractAllParticipants(conversations) {
  const participantsMap = new Map();
  
  conversations.forEach(conv => {
    conv.participants.forEach(p => {
      const key = `${p.name}-${p.platform}-${conv.conversationId}`;
      if (!participantsMap.has(key)) {
        participantsMap.set(key, {
          ...p,
          conversationId: conv.conversationId,
          conversationTitle: conv.title,
          messageCount: conv.messages.filter(m => m.sender === p.name).length
        });
      }
    });
  });
  
  return Array.from(participantsMap.values());
}
