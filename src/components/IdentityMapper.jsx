import React, { useState, useMemo } from 'react';
import { Users, ArrowRight, Plus, Trash2, Check, X } from 'lucide-react';

const IdentityMapper = ({ conversations, onComplete, onSkip }) => {
  const [mappingPairs, setMappingPairs] = useState([{ from: '', to: '' }]);

  // Extract all unique participants across conversations
  const allParticipants = useMemo(() => {
    const participantMap = new Map();
    
    conversations.forEach(conv => {
      conv.participants.forEach(participant => {
        const name = typeof participant === 'string' ? participant : participant.name;
        const platform = conv.source || 'unknown';
        const key = `${name}|||${platform}|||${conv.conversationId}`;
        
        if (!participantMap.has(key)) {
          participantMap.set(key, {
            name,
            platform,
            conversationId: conv.conversationId,
            conversationTitle: conv.title,
            key,
            displayName: `${name} (${platform})`
          });
        }
      });
    });
    
    return Array.from(participantMap.values());
  }, [conversations]);

  const addMappingPair = () => {
    setMappingPairs([...mappingPairs, { from: '', to: '' }]);
  };

  const removeMappingPair = (index) => {
    setMappingPairs(mappingPairs.filter((_, i) => i !== index));
  };

  const updateMapping = (index, field, value) => {
    const newMappings = [...mappingPairs];
    newMappings[index][field] = value;
    setMappingPairs(newMappings);
  };

  // Get participants that haven't been used yet in mappings
  const getAvailableParticipants = (currentIndex, field) => {
    return allParticipants.filter(p => {
      // Don't show participants already selected in other rows
      const isUsedElsewhere = mappingPairs.some((pair, idx) => {
        if (idx === currentIndex) return false;
        return pair.from === p.key || pair.to === p.key;
      });
      
      // Don't show the participant already selected in the other field of current row
      const currentPair = mappingPairs[currentIndex];
      const otherField = field === 'from' ? 'to' : 'from';
      const isUsedInOtherField = currentPair[otherField] === p.key;
      
      return !isUsedElsewhere && !isUsedInOtherField;
    });
  };

  const handleComplete = () => {
    // Filter out incomplete pairs
    const completePairs = mappingPairs.filter(pair => pair.from && pair.to);
    
    if (completePairs.length === 0) {
      onSkip();
      return;
    }

    // Convert mappings to the format expected by conversationMerger
    // Expected format: array of { person1: {...}, person2: {...} }
    const formattedMappings = completePairs.map(pair => {
      const fromParticipant = allParticipants.find(p => p.key === pair.from);
      const toParticipant = allParticipants.find(p => p.key === pair.to);
      
      return {
        person1: {
          name: fromParticipant.name,
          platform: fromParticipant.platform,
          conversationId: fromParticipant.conversationId,
          conversationTitle: fromParticipant.conversationTitle
        },
        person2: {
          name: toParticipant.name,
          platform: toParticipant.platform,
          conversationId: toParticipant.conversationId,
          conversationTitle: toParticipant.conversationTitle
        }
      };
    });
    
    onComplete(formattedMappings);
  };

  const validPairsCount = mappingPairs.filter(pair => pair.from && pair.to).length;

  return (
    <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
      <div className="flex items-center gap-3 mb-6">
        <Users className="w-8 h-8 text-purple-600" />
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-gray-800">Identity Mapping</h2>
          <p className="text-sm text-gray-600 mt-1">
            Connect the same person across different conversations to merge them into a unified timeline
          </p>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <p className="text-sm text-blue-800">
          <strong>How it works:</strong> Select a person from the left dropdown, then select who they are in another conversation from the right dropdown.
        </p>
        <p className="text-sm text-blue-700 mt-2">
          Example: "Tom (line)" → "Akira Tsunashima (instagram)" means Tom and Akira are the same person.
        </p>
      </div>

      <div className="space-y-4 mb-6">
        {mappingPairs.map((pair, index) => {
          const availableFrom = getAvailableParticipants(index, 'from');
          const availableTo = getAvailableParticipants(index, 'to');
          const fromParticipant = allParticipants.find(p => p.key === pair.from);
          const toParticipant = allParticipants.find(p => p.key === pair.to);

          return (
            <div key={index} className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-gray-600 mb-2">
                  Person 1
                </label>
                <select
                  value={pair.from}
                  onChange={(e) => updateMapping(index, 'from', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
                >
                  <option value="">Select person...</option>
                  {availableFrom.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.displayName}
                    </option>
                  ))}
                  {/* Show current selection even if not in available list */}
                  {fromParticipant && !availableFrom.find(p => p.key === pair.from) && (
                    <option value={pair.from}>{fromParticipant.displayName}</option>
                  )}
                </select>
              </div>

              <div className="flex items-center justify-center pt-6">
                <ArrowRight className="w-6 h-6 text-purple-500" />
              </div>

              <div className="flex-1">
                <label className="block text-xs font-semibold text-gray-600 mb-2">
                  Is the same as Person 2
                </label>
                <select
                  value={pair.to}
                  onChange={(e) => updateMapping(index, 'to', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
                >
                  <option value="">Select person...</option>
                  {availableTo.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.displayName}
                    </option>
                  ))}
                  {/* Show current selection even if not in available list */}
                  {toParticipant && !availableTo.find(p => p.key === pair.to) && (
                    <option value={pair.to}>{toParticipant.displayName}</option>
                  )}
                </select>
              </div>

              {mappingPairs.length > 1 && (
                <button
                  onClick={() => removeMappingPair(index)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors mt-6"
                  title="Remove this mapping"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      <button
        onClick={addMappingPair}
        className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-purple-400 hover:text-purple-600 transition-colors font-medium flex items-center justify-center gap-2"
      >
        <Plus className="w-5 h-5" />
        Add Another Mapping
      </button>

      <div className="flex gap-3 justify-end pt-6 mt-6 border-t border-gray-200">
        <button
          onClick={onSkip}
          className="px-6 py-3 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors font-medium flex items-center gap-2"
        >
          <X className="w-5 h-5" />
          Skip Mapping
        </button>
        <button
          onClick={handleComplete}
          className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium flex items-center gap-2"
        >
          <Check className="w-5 h-5" />
          {validPairsCount > 0 ? `Merge ${validPairsCount} Identity Mapping${validPairsCount !== 1 ? 's' : ''}` : 'Continue Without Mapping'}
        </button>
      </div>

      {validPairsCount > 0 && (
        <div className="mt-6 p-4 bg-purple-50 border border-purple-200 rounded-lg">
          <h4 className="font-semibold text-purple-900 mb-2 flex items-center gap-2">
            <Check className="w-5 h-5" />
            Active Mappings ({validPairsCount}):
          </h4>
          <ul className="text-sm text-purple-800 space-y-1">
            {mappingPairs
              .filter(pair => pair.from && pair.to)
              .map((pair, idx) => {
                const fromP = allParticipants.find(p => p.key === pair.from);
                const toP = allParticipants.find(p => p.key === pair.to);
                return (
                  <li key={idx} className="flex items-center gap-2">
                    <ArrowRight className="w-4 h-4" />
                    <span><strong>{fromP?.name}</strong> ({fromP?.platform}) = <strong>{toP?.name}</strong> ({toP?.platform})</span>
                  </li>
                );
              })}
          </ul>
        </div>
      )}
    </div>
  );
};

export default IdentityMapper;
