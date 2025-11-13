/**
 * Conversation Merger Utility
 * Merges conversations based on identity mappings
 */

/**
 * Merge conversations based on identity mappings
 */
export function mergeConversations(conversations, mappings) {
  if (!mappings || mappings.length === 0) {
    // No mappings, return conversations as-is
    return conversations;
  }
  
  // Create a map of participant identities
  const identityMap = createIdentityMap(mappings);
  
  // Group conversations by their canonical identity
  const groupedConversations = groupConversationsByIdentity(conversations, identityMap);
  
  // Merge grouped conversations
  const mergedConversations = Object.values(groupedConversations).map(group => {
    if (group.length === 1) {
      // Single conversation, no merging needed
      return group[0];
    }
    
    // Multiple conversations to merge
    return mergeConversationGroup(group, identityMap);
  });
  
  return mergedConversations;
}

/**
 * Create an identity map from mappings
 * Maps each participant to their canonical identity
 */
function createIdentityMap(mappings) {
  const identityMap = new Map();
  
  mappings.forEach((mapping, idx) => {
    if (!mapping.person1 || !mapping.person2) return;
    
    const canonicalId = `merged-${idx}`;
    
    // Map both people to the same canonical identity
    const key1 = `${mapping.person1.name}|||${mapping.person1.conversationId}`;
    const key2 = `${mapping.person2.name}|||${mapping.person2.conversationId}`;
    
    identityMap.set(key1, {
      canonicalId,
      canonicalName: mapping.person1.name, // Use first person's name as canonical
      alternateNames: [mapping.person1.name, mapping.person2.name],
      platforms: [mapping.person1.platform, mapping.person2.platform]
    });
    
    identityMap.set(key2, {
      canonicalId,
      canonicalName: mapping.person1.name,
      alternateNames: [mapping.person1.name, mapping.person2.name],
      platforms: [mapping.person1.platform, mapping.person2.platform]
    });
  });
  
  return identityMap;
}

/**
 * Group conversations by their canonical identity
 */
function groupConversationsByIdentity(conversations, identityMap) {
  const groups = {};
  
  conversations.forEach(conv => {
    // Get canonical identity for this conversation's participants
    const participantKeys = conv.participants.map(p => 
      `${p.name}|||${conv.conversationId}`
    );
    
    // Check if any participant is mapped
    let groupKey = conv.conversationId; // Default: use conversation ID as group key
    
    for (const key of participantKeys) {
      const identity = identityMap.get(key);
      if (identity) {
        groupKey = identity.canonicalId;
        break;
      }
    }
    
    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(conv);
  });
  
  return groups;
}

/**
 * Merge a group of conversations into a single conversation
 */
function mergeConversationGroup(conversations, identityMap) {
  // Sort conversations by their start date
  const sortedConvs = [...conversations].sort((a, b) => 
    (a.dateRange.start?.getTime() || 0) - (b.dateRange.start?.getTime() || 0)
  );
  
  // Collect all messages
  const allMessages = [];
  sortedConvs.forEach(conv => {
    allMessages.push(...conv.messages);
  });
  
  // Sort messages by timestamp
  allMessages.sort((a, b) => a.timestamp - b.timestamp);
  
  // Normalize sender names using identity map
  allMessages.forEach(msg => {
    const conv = sortedConvs.find(c => 
      c.messages.some(m => m === msg)
    );
    if (conv) {
      const key = `${msg.sender}|||${conv.conversationId}`;
      const identity = identityMap.get(key);
      if (identity) {
        msg.originalSender = msg.sender;
        msg.sender = identity.canonicalName;
      }
    }
  });
  
  // Get unique canonical participants
  const canonicalParticipants = getCanonicalParticipants(sortedConvs, identityMap);
  
  // Create merged conversation
  const sources = sortedConvs.map(c => c.source);
  const uniqueSources = [...new Set(sources)];
  
  return {
    source: uniqueSources.length === 1 ? uniqueSources[0] : 'merged',
    conversationId: `merged-${sortedConvs.map(c => c.conversationId).join('-')}`,
    title: createMergedTitle(canonicalParticipants, uniqueSources),
    participants: canonicalParticipants,
    messages: allMessages,
    dateRange: {
      start: allMessages[0]?.date || null,
      end: allMessages[allMessages.length - 1]?.date || null
    },
    totalMessages: allMessages.length,
    isMerged: true,
    sourceConversations: sortedConvs.map(c => ({
      title: c.title,
      source: c.source,
      messageCount: c.messages.length,
      dateRange: c.dateRange
    }))
  };
}

/**
 * Get canonical participants from conversations
 */
function getCanonicalParticipants(conversations, identityMap) {
  const participantMap = new Map();
  
  conversations.forEach(conv => {
    conv.participants.forEach(p => {
      const key = `${p.name}|||${conv.conversationId}`;
      const identity = identityMap.get(key);
      
      const canonicalName = identity ? identity.canonicalName : p.name;
      
      if (!participantMap.has(canonicalName)) {
        participantMap.set(canonicalName, {
          name: canonicalName,
          platform: identity ? 'multiple' : p.platform,
          rawIdentifier: p.rawIdentifier,
          alternateNames: identity ? identity.alternateNames : [p.name],
          platforms: identity ? identity.platforms : [p.platform]
        });
      }
    });
  });
  
  return Array.from(participantMap.values());
}

/**
 * Create a descriptive title for merged conversation
 */
function createMergedTitle(participants, sources) {
  const names = participants.map(p => p.name).join(' & ');
  const platforms = sources.join(' + ');
  return `${names} (${platforms})`;
}

/**
 * Get statistics for a merged conversation
 */
export function getMergedConversationStats(conversation) {
  if (!conversation.isMerged) {
    return null;
  }
  
  const stats = {
    totalSources: conversation.sourceConversations.length,
    sources: conversation.sourceConversations.map(sc => ({
      title: sc.title,
      source: sc.source,
      messageCount: sc.messageCount,
      percentage: ((sc.messageCount / conversation.totalMessages) * 100).toFixed(1)
    })),
    dateRange: conversation.dateRange,
    messagesBySource: {}
  };
  
  // Count messages by source
  conversation.sourceConversations.forEach(sc => {
    stats.messagesBySource[sc.source] = sc.messageCount;
  });
  
  return stats;
}
