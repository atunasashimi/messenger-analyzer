import React, { useState, useMemo } from 'react';
import { Upload, MessageSquare, TrendingUp, User, Calendar, Brain, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const MessengerAnalysis = () => {
  const [files, setFiles] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expandedMonths, setExpandedMonths] = useState({});
  const [parseErrors, setParseErrors] = useState([]);

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

  const handleFileUpload = async (e) => {
    const uploadedFiles = Array.from(e.target.files);
    setFiles(uploadedFiles);
    setParseErrors([]);
    
    // Parse all JSON files
    const parsedConversations = [];
    const errors = [];
    
    for (const file of uploadedFiles) {
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        
        console.log('Parsing file:', file.name);
        console.log('Data structure:', {
          hasMessages: !!data.messages,
          messageCount: data.messages?.length,
          hasParticipants: !!data.participants,
          participantCount: data.participants?.length,
          title: data.title,
          sampleMessage: data.messages?.[0]
        });
        
        // Facebook Messenger export format parsing
        if (data.messages && Array.isArray(data.messages) && data.messages.length > 0) {
          const participants = data.participants?.map(p => decodeFacebookText(p.name)) || [];
          
          const messages = data.messages
            .filter(msg => {
              // Filter out messages without content or with only reactions/media
              return msg.content || msg.photos || msg.videos || msg.audio_files || msg.files;
            })
            .map(msg => {
              let content = '';
              
              if (msg.content) {
                content = decodeFacebookText(msg.content);
              } else if (msg.photos) {
                content = '[Photo]';
              } else if (msg.videos) {
                content = '[Video]';
              } else if (msg.audio_files) {
                content = '[Audio]';
              } else if (msg.files) {
                content = '[File]';
              } else if (msg.share) {
                content = '[Shared link]';
              } else {
                content = '[Media]';
              }
              
              return {
                sender: decodeFacebookText(msg.sender_name),
                content: content,
                timestamp: msg.timestamp_ms,
                date: new Date(msg.timestamp_ms)
              };
            })
            .filter(msg => msg.timestamp && msg.sender && msg.content)
            .sort((a, b) => a.timestamp - b.timestamp);
          
          if (messages.length > 0 && participants.length > 0) {
            parsedConversations.push({
              participants,
              messages,
              title: decodeFacebookText(data.title) || participants.join(', ')
            });
            console.log(`Successfully parsed: ${messages.length} messages with ${participants.length} participants`);
          } else {
            errors.push(`${file.name}: No valid messages or participants found`);
          }
        } else {
          errors.push(`${file.name}: Invalid format - missing messages array`);
        }
      } catch (error) {
        console.error(`Error parsing ${file.name}:`, error);
        errors.push(`${file.name}: ${error.message}`);
      }
    }
    
    setParseErrors(errors);
    setConversations(parsedConversations);
    
    if (parsedConversations.length === 0 && errors.length > 0) {
      alert('Failed to parse any conversations. Check the console for details.');
    }
  };

  // Extract unique people from conversations
  const people = useMemo(() => {
    const peopleMap = new Map();
    
    conversations.forEach(conv => {
      conv.participants.forEach(person => {
        if (!peopleMap.has(person)) {
          peopleMap.set(person, {
            name: person,
            messageCount: 0,
            conversations: []
          });
        }
        
        const personData = peopleMap.get(person);
        personData.messageCount += conv.messages.filter(m => m.sender === person).length;
        personData.conversations.push(conv);
      });
    });
    
    return Array.from(peopleMap.values()).sort((a, b) => b.messageCount - a.messageCount);
  }, [conversations]);

  // Analyze conversation with selected person
  const analyzeConversation = async (person) => {
    setSelectedPerson(person);
    setLoading(true);
    setAnalysis(null);
    
    try {
      // Gather all messages with this person
      const allMessages = [];
      person.conversations.forEach(conv => {
        conv.messages.forEach(msg => {
          allMessages.push(msg);
        });
      });
      
      allMessages.sort((a, b) => a.timestamp - b.timestamp);
      
      if (allMessages.length === 0) {
        throw new Error('No messages found for this person');
      }
      
      // Group messages by month for timeline
      const messagesByMonth = {};
      allMessages.forEach(msg => {
        const monthKey = `${msg.date.getFullYear()}-${String(msg.date.getMonth() + 1).padStart(2, '0')}`;
        if (!messagesByMonth[monthKey]) {
          messagesByMonth[monthKey] = [];
        }
        messagesByMonth[monthKey].push(msg);
      });
      
      // Create sample of messages for analysis (to avoid token limits)
      const sampleMessages = [];
      const monthKeys = Object.keys(messagesByMonth).sort();
      
      // If there are many months, sample more strategically
      const monthsToSample = monthKeys.length > 12 ? 
        [...monthKeys.slice(0, 3), ...monthKeys.slice(Math.floor(monthKeys.length / 2) - 1, Math.floor(monthKeys.length / 2) + 2), ...monthKeys.slice(-3)] :
        monthKeys;
      
      monthsToSample.forEach(month => {
        const monthMessages = messagesByMonth[month];
        // Take first 10, middle 10, and last 10 messages from each month
        const first = monthMessages.slice(0, 10);
        const middle = monthMessages.slice(Math.floor(monthMessages.length / 2) - 5, Math.floor(monthMessages.length / 2) + 5);
        const last = monthMessages.slice(-10);
        
        // Combine and deduplicate
        const combined = [...first, ...middle, ...last];
        const unique = Array.from(new Set(combined.map(m => m.timestamp))).map(ts => 
          combined.find(m => m.timestamp === ts)
        );
        
        sampleMessages.push({ month, messages: unique });
      });
      
      // Prepare analysis prompt
      const conversationSummary = sampleMessages.map(({ month, messages }) => {
        return `\n=== ${month} (${messagesByMonth[month].length} total messages) ===\n` + messages.map(m => 
          `[${m.date.toLocaleDateString()} ${m.date.toLocaleTimeString()}] ${m.sender}: ${m.content}`
        ).join('\n');
      }).join('\n');
      
      const analysisPrompt = `You are a conversational psychoanalyst. Analyze this conversation history between people, focusing on relationship dynamics, emotional patterns, and how the relationship has evolved over time.

IMPORTANT CONTEXT:
- Total messages in conversation: ${allMessages.length}
- Time span: ${allMessages[0].date.toLocaleDateString()} to ${allMessages[allMessages.length - 1].date.toLocaleDateString()}
- Number of months: ${monthKeys.length}
- This is a SAMPLE of the conversation (showing key messages from each month)

Conversation History Sample:
${conversationSummary}

Please provide a comprehensive psychoanalytic assessment in the following JSON format. YOUR ENTIRE RESPONSE MUST BE VALID JSON WITH NO OTHER TEXT:

{
  "overallAssessment": "A comprehensive 3-4 sentence summary of the relationship dynamics and evolution based on the actual conversation content",
  "relationshipPhases": [
    {
      "period": "Time period description (e.g., 'Early 2023', 'Mid 2024')",
      "description": "What characterized this phase based on actual messages",
      "emotionalTone": "Dominant emotional tone observed",
      "keyThemes": ["theme1", "theme2", "theme3"]
    }
  ],
  "communicationPatterns": {
    "initiationDynamics": "Who initiates conversations and what this reveals based on the data",
    "responsePatterns": "How each person responds to the other based on actual exchanges",
    "conversationalBalance": "Assessment of give-and-take based on message patterns"
  },
  "emotionalDynamics": {
    "attachmentStyle": "Observed attachment patterns from the messages",
    "conflictResolution": "How conflicts or tensions are handled (if observed)",
    "intimacyLevel": "Assessment of emotional intimacy over time based on content"
  },
  "evolutionTimeline": [
    {
      "phase": "Phase name",
      "timeframe": "Approximate dates from the data",
      "characteristics": "Key characteristics observed in messages",
      "sentiment": "positive/neutral/negative/mixed"
    }
  ],
  "insights": [
    "Specific psychological insight based on message patterns",
    "Another insight from actual conversation dynamics",
    "Third insight from observed behaviors"
  ],
  "recommendations": [
    "Actionable recommendation for relationship health based on analysis"
  ]
}

CRITICAL: Base your analysis ONLY on the actual message content provided. Do not make assumptions. If data is limited, acknowledge that in your assessment.`;

      console.log('Sending analysis request with', allMessages.length, 'total messages');

      // Call backend API instead of Claude directly
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: analysisPrompt
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'API request failed');
      }

      const data = await response.json();
      let responseText = data.content[0].text;
      
      console.log('Raw API response:', responseText);
      
      // Strip markdown code blocks if present
      responseText = responseText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      
      const analysisResult = JSON.parse(responseText);
      
      // Calculate statistics for visualization
      const stats = {
        messagesByMonth: Object.keys(messagesByMonth).sort().map(month => ({
          month,
          count: messagesByMonth[month].length,
          userMessages: messagesByMonth[month].filter(m => m.sender === person.name).length,
          otherMessages: messagesByMonth[month].filter(m => m.sender !== person.name).length
        })),
        totalMessages: allMessages.length,
        userMessageCount: allMessages.filter(m => m.sender === person.name).length,
        avgMessagesPerDay: allMessages.length / Math.max(1, (allMessages[allMessages.length - 1].date - allMessages[0].date) / (1000 * 60 * 60 * 24)),
        timespan: {
          start: allMessages[0].date.toLocaleDateString(),
          end: allMessages[allMessages.length - 1].date.toLocaleDateString()
        },
        messagesByMonth
      };
      
      setAnalysis({
        ...analysisResult,
        stats,
        person: person.name
      });
      
    } catch (error) {
      console.error("Analysis error:", error);
      setAnalysis({
        error: "Failed to analyze conversation. Please try again.",
        errorDetails: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleMonth = (month) => {
    setExpandedMonths(prev => ({
      ...prev,
      [month]: !prev[month]
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <Brain className="w-8 h-8 text-purple-600" />
            <h1 className="text-3xl font-bold text-gray-800">
              Messenger Relationship Analyzer
            </h1>
          </div>
          
          <p className="text-gray-600 mb-6">
            Upload your Facebook Messenger JSON exports to analyze conversation patterns and relationship dynamics over time.
          </p>
          
          <div className="border-2 border-dashed border-purple-300 rounded-lg p-8 text-center hover:border-purple-500 transition-colors">
            <input
              type="file"
              multiple
              accept=".json"
              onChange={handleFileUpload}
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className="cursor-pointer flex flex-col items-center gap-3"
            >
              <Upload className="w-12 h-12 text-purple-500" />
              <span className="text-lg font-medium text-gray-700">
                Click to upload JSON files
              </span>
              <span className="text-sm text-gray-500">
                {files.length > 0 ? `${files.length} files selected` : 'Select multiple files'}
              </span>
            </label>
          </div>
          
          {parseErrors.length > 0 && (
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <h3 className="font-semibold text-yellow-800 mb-2">Parsing Issues:</h3>
              <ul className="text-sm text-yellow-700 space-y-1">
                {parseErrors.map((error, idx) => (
                  <li key={idx}>• {error}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {people.length > 0 && (
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
            <div className="flex items-center gap-3 mb-6">
              <User className="w-6 h-6 text-blue-600" />
              <h2 className="text-2xl font-bold text-gray-800">
                People in Your Conversations ({people.length})
              </h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {people.map((person, idx) => (
                <div
                  key={idx}
                  onClick={() => analyzeConversation(person)}
                  className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg p-4 cursor-pointer hover:shadow-lg transition-all border-2 border-transparent hover:border-purple-300"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-purple-200 rounded-full flex items-center justify-center">
                      <User className="w-6 h-6 text-purple-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-800">{person.name}</h3>
                      <p className="text-sm text-gray-600">
                        {person.messageCount.toLocaleString()} messages
                      </p>
                    </div>
                    <MessageSquare className="w-5 h-5 text-purple-400" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {loading && (
          <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-lg text-gray-600">Analyzing conversation patterns...</p>
            <p className="text-sm text-gray-500 mt-2">This may take a minute</p>
          </div>
        )}

        {analysis && !loading && (
          <div className="space-y-8">
            {analysis.error ? (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-8">
                <div className="flex items-center gap-3 mb-4">
                  <AlertCircle className="w-6 h-6 text-red-600" />
                  <h3 className="text-xl font-bold text-red-800">Analysis Error</h3>
                </div>
                <p className="text-red-600">{analysis.error}</p>
                {analysis.errorDetails && (
                  <p className="text-sm text-red-500 mt-2">{analysis.errorDetails}</p>
                )}
              </div>
            ) : (
              <>
                {/* Overall Assessment */}
                <div className="bg-white rounded-2xl shadow-xl p-8">
                  <div className="flex items-center gap-3 mb-4">
                    <Brain className="w-6 h-6 text-purple-600" />
                    <h2 className="text-2xl font-bold text-gray-800">
                      Analysis: {analysis.person}
                    </h2>
                  </div>
                  <p className="text-gray-700 leading-relaxed text-lg">{analysis.overallAssessment}</p>
                </div>

                {/* Statistics */}
                <div className="bg-white rounded-2xl shadow-xl p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <TrendingUp className="w-6 h-6 text-blue-600" />
                    <h2 className="text-2xl font-bold text-gray-800">Conversation Statistics</h2>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <div className="bg-blue-50 rounded-lg p-4">
                      <p className="text-sm text-gray-600 mb-1">Total Messages</p>
                      <p className="text-2xl font-bold text-blue-600">{analysis.stats.totalMessages.toLocaleString()}</p>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-4">
                      <p className="text-sm text-gray-600 mb-1">Their Messages</p>
                      <p className="text-2xl font-bold text-purple-600">{analysis.stats.userMessageCount.toLocaleString()}</p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4">
                      <p className="text-sm text-gray-600 mb-1">Avg Per Day</p>
                      <p className="text-2xl font-bold text-green-600">{analysis.stats.avgMessagesPerDay.toFixed(1)}</p>
                    </div>
                    <div className="bg-orange-50 rounded-lg p-4">
                      <p className="text-sm text-gray-600 mb-1">Time Span</p>
                      <p className="text-xs font-semibold text-orange-600">
                        {analysis.stats.timespan.start}<br/>to {analysis.stats.timespan.end}
                      </p>
                    </div>
                  </div>

                  {/* Message Timeline Chart */}
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={analysis.stats.messagesByMonth}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" angle={-45} textAnchor="end" height={80} />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="count" stroke="#8b5cf6" name="Total Messages" strokeWidth={2} />
                      <Line type="monotone" dataKey="userMessages" stroke="#3b82f6" name="Their Messages" strokeWidth={2} />
                      <Line type="monotone" dataKey="otherMessages" stroke="#10b981" name="Your Messages" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Relationship Phases */}
                {analysis.relationshipPhases && analysis.relationshipPhases.length > 0 && (
                  <div className="bg-white rounded-2xl shadow-xl p-8">
                    <div className="flex items-center gap-3 mb-6">
                      <Calendar className="w-6 h-6 text-purple-600" />
                      <h2 className="text-2xl font-bold text-gray-800">Relationship Phases</h2>
                    </div>
                    
                    <div className="space-y-4">
                      {analysis.relationshipPhases.map((phase, idx) => (
                        <div key={idx} className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-6 border-l-4 border-purple-500">
                          <h3 className="font-bold text-lg text-gray-800 mb-2">{phase.period}</h3>
                          <p className="text-gray-700 mb-3">{phase.description}</p>
                          <div className="flex flex-wrap gap-2">
                            <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
                              {phase.emotionalTone}
                            </span>
                            {phase.keyThemes && phase.keyThemes.map((theme, i) => (
                              <span key={i} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                                {theme}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Communication Patterns */}
                {analysis.communicationPatterns && (
                  <div className="bg-white rounded-2xl shadow-xl p-8">
                    <h2 className="text-2xl font-bold text-gray-800 mb-6">Communication Patterns</h2>
                    
                    <div className="space-y-4">
                      <div className="bg-blue-50 rounded-lg p-4">
                        <h3 className="font-semibold text-gray-800 mb-2">Initiation Dynamics</h3>
                        <p className="text-gray-700">{analysis.communicationPatterns.initiationDynamics}</p>
                      </div>
                      
                      <div className="bg-purple-50 rounded-lg p-4">
                        <h3 className="font-semibold text-gray-800 mb-2">Response Patterns</h3>
                        <p className="text-gray-700">{analysis.communicationPatterns.responsePatterns}</p>
                      </div>
                      
                      <div className="bg-green-50 rounded-lg p-4">
                        <h3 className="font-semibold text-gray-800 mb-2">Conversational Balance</h3>
                        <p className="text-gray-700">{analysis.communicationPatterns.conversationalBalance}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Emotional Dynamics */}
                {analysis.emotionalDynamics && (
                  <div className="bg-white rounded-2xl shadow-xl p-8">
                    <h2 className="text-2xl font-bold text-gray-800 mb-6">Emotional Dynamics</h2>
                    
                    <div className="space-y-4">
                      <div className="bg-pink-50 rounded-lg p-4">
                        <h3 className="font-semibold text-gray-800 mb-2">Attachment Style</h3>
                        <p className="text-gray-700">{analysis.emotionalDynamics.attachmentStyle}</p>
                      </div>
                      
                      <div className="bg-yellow-50 rounded-lg p-4">
                        <h3 className="font-semibold text-gray-800 mb-2">Conflict Resolution</h3>
                        <p className="text-gray-700">{analysis.emotionalDynamics.conflictResolution}</p>
                      </div>
                      
                      <div className="bg-indigo-50 rounded-lg p-4">
                        <h3 className="font-semibold text-gray-800 mb-2">Intimacy Level</h3>
                        <p className="text-gray-700">{analysis.emotionalDynamics.intimacyLevel}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Evolution Timeline */}
                {analysis.evolutionTimeline && analysis.evolutionTimeline.length > 0 && (
                  <div className="bg-white rounded-2xl shadow-xl p-8">
                    <h2 className="text-2xl font-bold text-gray-800 mb-6">Evolution Timeline</h2>
                    
                    <div className="relative">
                      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-300"></div>
                      
                      <div className="space-y-6">
                        {analysis.evolutionTimeline.map((phase, idx) => {
                          const colors = {
                            positive: 'bg-green-500',
                            negative: 'bg-red-500',
                            neutral: 'bg-gray-500',
                            mixed: 'bg-yellow-500'
                          };
                          
                          return (
                            <div key={idx} className="relative pl-12">
                              <div className={`absolute left-2 w-4 h-4 rounded-full ${colors[phase.sentiment] || 'bg-blue-500'} border-4 border-white`}></div>
                              <div className="bg-gray-50 rounded-lg p-4">
                                <h3 className="font-bold text-gray-800">{phase.phase}</h3>
                                <p className="text-sm text-gray-600 mb-2">{phase.timeframe}</p>
                                <p className="text-gray-700">{phase.characteristics}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* Key Insights */}
                {analysis.insights && analysis.insights.length > 0 && (
                  <div className="bg-white rounded-2xl shadow-xl p-8">
                    <h2 className="text-2xl font-bold text-gray-800 mb-6">Key Psychological Insights</h2>
                    
                    <div className="space-y-3">
                      {analysis.insights.map((insight, idx) => (
                        <div key={idx} className="flex gap-3 items-start">
                          <div className="w-6 h-6 bg-purple-200 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                            <span className="text-purple-700 font-bold text-sm">{idx + 1}</span>
                          </div>
                          <p className="text-gray-700 flex-1">{insight}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recommendations */}
                {analysis.recommendations && analysis.recommendations.length > 0 && (
                  <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-2xl shadow-xl p-8 border-2 border-purple-200">
                    <h2 className="text-2xl font-bold text-gray-800 mb-6">Recommendations</h2>
                    
                    <div className="space-y-3">
                      {analysis.recommendations.map((rec, idx) => (
                        <div key={idx} className="bg-white rounded-lg p-4 shadow-sm">
                          <p className="text-gray-700">{rec}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Conversation Explorer */}
                <div className="bg-white rounded-2xl shadow-xl p-8">
                  <h2 className="text-2xl font-bold text-gray-800 mb-6">Conversation Explorer</h2>
                  <p className="text-gray-600 mb-4">Browse messages by month</p>
                  
                  <div className="space-y-2">
                    {Object.keys(analysis.stats.messagesByMonth).sort().reverse().map(month => {
                      const messages = analysis.stats.messagesByMonth[month];
                      const isExpanded = expandedMonths[month];
                      
                      return (
                        <div key={month} className="border border-gray-200 rounded-lg overflow-hidden">
                          <button
                            onClick={() => toggleMonth(month)}
                            className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 flex items-center justify-between transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <Calendar className="w-5 h-5 text-gray-600" />
                              <span className="font-semibold text-gray-800">{month}</span>
                              <span className="text-sm text-gray-600">({messages.length} messages)</span>
                            </div>
                            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                          </button>
                          
                          {isExpanded && (
                            <div className="p-4 bg-white max-h-96 overflow-y-auto">
                              <div className="space-y-2">
                                {messages.slice(0, 100).map((msg, idx) => (
                                  <div key={idx} className={`p-3 rounded-lg ${msg.sender === analysis.person ? 'bg-blue-50 ml-8' : 'bg-gray-50 mr-8'}`}>
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="font-semibold text-sm text-gray-800">{msg.sender}</span>
                                      <span className="text-xs text-gray-500">{msg.date.toLocaleString()}</span>
                                    </div>
                                    <p className="text-gray-700 text-sm">{msg.content}</p>
                                  </div>
                                ))}
                                {messages.length > 100 && (
                                  <p className="text-center text-sm text-gray-500 pt-2">
                                    Showing first 100 of {messages.length} messages
                                  </p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MessengerAnalysis;
