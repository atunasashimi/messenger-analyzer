import React, { useState, useMemo } from 'react';
import { Upload, MessageSquare, TrendingUp, User, Calendar, Brain, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { parseConversations } from './adapters/index';
import { mergeConversations } from './utils/conversationMerger';
import IdentityMapper from './components/IdentityMapper';

const MessengerAnalysis = () => {
  const [files, setFiles] = useState([]);
  const [parsedConversations, setParsedConversations] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expandedMonths, setExpandedMonths] = useState({});
  const [parseErrors, setParseErrors] = useState([]);
  const [showIdentityMapper, setShowIdentityMapper] = useState(false);

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
    setLoading(true);
    
    try {
      // Use the universal adapter system
      const { conversations: parsed, errors } = await parseConversations(uploadedFiles);
      
      console.log('Parsed conversations:', parsed);
      console.log('Parse errors:', errors);
      
      setParsedConversations(parsed);
      setParseErrors(errors);
      
      if (parsed.length === 0) {
        setLoading(false);
        alert('Failed to parse any conversations. Check the errors below.');
        return;
      }
      
      // Show identity mapper if we have multiple conversations
      if (parsed.length > 1) {
        setShowIdentityMapper(true);
      } else {
        // Single conversation, no need for identity mapping
        setConversations(parsed);
        setShowIdentityMapper(false);
      }
      
    } catch (error) {
      console.error('File upload error:', error);
      setParseErrors([{ fileName: 'System', error: error.message }]);
    } finally {
      setLoading(false);
    }
  };

  const handleIdentityMappingComplete = (mappings) => {
    console.log('Applying mappings:', mappings);
    const merged = mergeConversations(parsedConversations, mappings);
    console.log('Merged conversations:', merged);
    setConversations(merged);
    setShowIdentityMapper(false);
  };

  const handleIdentityMappingSkip = () => {
    console.log('Skipping identity mapping');
    setConversations(parsedConversations);
    setShowIdentityMapper(false);
  };

  // Extract conversations with participant pairs
  const conversationList = useMemo(() => {
    return conversations.map(conv => {
      const messageCount = conv.messages.length;
      const participants = conv.participants;
      
      // Normalize participants to strings
      const participantNames = participants.map(p => 
        typeof p === 'string' ? p : p.name
      );
      
      // Calculate message distribution between participants
      const messageCounts = {};
      participantNames.forEach(name => {
        messageCounts[name] = conv.messages.filter(m => m.sender === name).length;
      });
      
      return {
        title: conv.title,
        participants: participantNames,
        messageCount: messageCount,
        messageCounts: messageCounts,
        messages: conv.messages,
        dateRange: {
          start: conv.messages[0]?.date,
          end: conv.messages[conv.messages.length - 1]?.date
        },
        isMerged: conv.isMerged || false
      };
    }).sort((a, b) => b.messageCount - a.messageCount);
  }, [conversations]);

  // Analyze conversation between participants
  const analyzeConversation = async (conversation) => {
    setSelectedPerson(conversation);
    setLoading(true);
    setAnalysis(null);
    
    try {
      const allMessages = conversation.messages;
      
      if (allMessages.length === 0) {
        throw new Error('No messages found in this conversation');
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
      
      // Get participant names for the analysis
      const participant1 = conversation.participants[0];
      const participant2 = conversation.participants[1];
      
      // Prepare analysis prompt focusing on relationship between the two people
      const conversationSummary = sampleMessages.map(({ month, messages }) => {
        return `\n=== ${month} (${messagesByMonth[month].length} total messages) ===\n` + messages.map(m => 
          `[${m.date.toLocaleDateString()} ${m.date.toLocaleTimeString()}] ${m.sender}: ${m.content}`
        ).join('\n');
      }).join('\n');
      
      const analysisPrompt = `You are a conversational psychoanalyst. Analyze this conversation between ${participant1} and ${participant2}, focusing on their relationship dynamics, emotional patterns, and how their relationship has evolved over time.

IMPORTANT CONTEXT:
- Participants: ${participant1} and ${participant2}
- Total messages in conversation: ${allMessages.length}
- Date range: ${new Date(Math.min(...allMessages.map(m => m.date))).toLocaleDateString()} to ${new Date(Math.max(...allMessages.map(m => m.date))).toLocaleDateString()}
- Below is a SAMPLE of messages from different time periods (not the full conversation)

CONVERSATION SAMPLE:
${conversationSummary}

Please provide a comprehensive psychological analysis in the following JSON format (respond ONLY with valid JSON, no other text):

{
  "overallAssessment": "A comprehensive overview of the relationship dynamics between these two people",
  "relationshipPhases": [
    {
      "period": "Month/Year range",
      "description": "What characterized this phase",
      "emotionalTone": "The emotional quality of interactions",
      "keyThemes": ["theme1", "theme2"]
    }
  ],
  "communicationPatterns": {
    "initiationDynamics": "Who tends to initiate conversations and how",
    "responsePatterns": "How each person responds to the other",
    "conversationalBalance": "Assessment of balance in the conversation"
  },
  "emotionalDynamics": {
    "attachmentStyle": "Observable attachment patterns in the relationship",
    "conflictResolution": "How they handle disagreements or tensions",
    "intimacyLevel": "The depth of emotional sharing and vulnerability"
  },
  "evolutionTimeline": [
    {
      "phase": "Phase name",
      "timeframe": "Time period",
      "characteristics": "Key characteristics of this evolution phase",
      "sentiment": "positive|negative|neutral|mixed"
    }
  ],
  "insights": [
    "Deep psychological insight about the relationship",
    "Another important observation"
  ],
  "recommendations": [
    "Suggestion for improving or maintaining the relationship"
  ]
}

Remember: Respond ONLY with the JSON object, no explanatory text before or after.`;

      console.log('Sending analysis request with', sampleMessages.reduce((acc, s) => acc + s.messages.length, 0), 'sample messages');
      
      // Send to API
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt: analysisPrompt
        })
      });
      
      if (!response.ok) {
        throw new Error(`Analysis failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Raw API response:', data);
      
      // Parse the analysis from the response
      let analysisResult;
      try {
        // The API returns { content: [{ text: "..." }] }
        const responseText = data.content[0].text;
        console.log('Response text:', responseText);
        
        // Try to extract JSON from the response
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          analysisResult = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found in response');
        }
      } catch (parseError) {
        console.error('Failed to parse analysis:', parseError);
        throw new Error('Failed to parse analysis results');
      }
      
      // Enhance with statistics
      const enhancedAnalysis = {
        ...analysisResult,
        person: conversation.participants.join(' & '),
        stats: {
          totalMessages: allMessages.length,
          dateRange: {
            start: new Date(Math.min(...allMessages.map(m => m.date))),
            end: new Date(Math.max(...allMessages.map(m => m.date)))
          },
          messagesByMonth,
          messagesPerPerson: conversation.participants.reduce((acc, p) => {
            acc[p] = allMessages.filter(m => m.sender === p).length;
            return acc;
          }, {})
        }
      };
      
      console.log('Enhanced analysis:', enhancedAnalysis);
      setAnalysis(enhancedAnalysis);
      
    } catch (error) {
      console.error('Analysis error:', error);
      alert(`Analysis failed: ${error.message}`);
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
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Upload Section */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <Brain className="w-8 h-8 text-purple-600" />
            <h1 className="text-3xl font-bold text-gray-800">
              Messenger Relationship Analyzer
            </h1>
          </div>
          
          <p className="text-gray-600 mb-6">
            Upload your messenger exports to analyze conversation patterns and relationship dynamics over time. Supports Facebook, Instagram (JSON), Line Messenger (TXT), and WhatsApp (TXT).
          </p>
          
          <div className="border-2 border-dashed border-purple-300 rounded-lg p-8 text-center hover:border-purple-500 transition-colors">
            <input
              type="file"
              multiple
              accept=".json,.txt"
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
                Click to upload JSON or TXT files
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
                  <li key={idx}>• {error.fileName}: {error.error}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Identity Mapper */}
        {showIdentityMapper && (
          <IdentityMapper
            conversations={parsedConversations}
            onComplete={handleIdentityMappingComplete}
            onSkip={handleIdentityMappingSkip}
          />
        )}

        {/* Conversation Selection */}
        {!showIdentityMapper && conversations.length > 0 && (
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Select a Conversation</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {conversationList.map((conv, idx) => (
                <div
                  key={idx}
                  onClick={() => analyzeConversation(conv)}
                  className="border-2 border-gray-200 rounded-xl p-6 hover:border-purple-400 hover:shadow-lg transition-all cursor-pointer group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-5 h-5 text-purple-500" />
                      <h3 className="font-semibold text-gray-800 group-hover:text-purple-600">
                        {conv.title}
                      </h3>
                      {conv.isMerged && (
                        <span className="px-2 py-1 bg-purple-500 text-white text-xs rounded-full font-medium">
                          Merged
                        </span>
                      )}
                    </div>
                    <span className="text-sm text-gray-500">{conv.messageCount} msgs</span>
                  </div>
                  
                  <div className="space-y-2">
                    {conv.participants.map((p, pidx) => (
                      <div key={pidx} className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">{p}</span>
                        <span className="text-gray-500">{conv.messageCounts[p]} messages</span>
                      </div>
                    ))}
                  </div>
                  
                  {conv.dateRange.start && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Calendar className="w-3 h-3" />
                        <span>
                          {conv.dateRange.start.toLocaleDateString()} - {conv.dateRange.end.toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
            <div className="animate-spin w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-600">Analyzing conversation patterns...</p>
          </div>
        )}

        {/* Analysis Results */}
        {selectedPerson && analysis && !loading && (
          <div className="space-y-6">
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl shadow-xl p-8 text-white">
              <div className="flex items-center gap-3 mb-4">
                <User className="w-8 h-8" />
                <h2 className="text-3xl font-bold">{analysis.person}</h2>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                <div className="bg-white/10 backdrop-blur rounded-lg p-4">
                  <p className="text-sm opacity-90">Total Messages</p>
                  <p className="text-2xl font-bold">{analysis.stats.totalMessages.toLocaleString()}</p>
                </div>
                
                <div className="bg-white/10 backdrop-blur rounded-lg p-4">
                  <p className="text-sm opacity-90">Time Span</p>
                  <p className="text-2xl font-bold">
                    {Math.round((analysis.stats.dateRange.end - analysis.stats.dateRange.start) / (1000 * 60 * 60 * 24 * 30))} months
                  </p>
                </div>
                
                {Object.keys(analysis.stats.messagesPerPerson).map((person, idx) => (
                  <div key={idx} className="bg-white/10 backdrop-blur rounded-lg p-4">
                    <p className="text-sm opacity-90">{person}</p>
                    <p className="text-2xl font-bold">{analysis.stats.messagesPerPerson[person].toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Overall Assessment */}
            <div className="bg-white rounded-2xl shadow-xl p-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Overall Assessment</h2>
              <p className="text-gray-700 leading-relaxed">{analysis.overallAssessment}</p>
            </div>

            {/* Message Timeline Chart */}
            {analysis.stats.messagesByMonth && (
              <div className="bg-white rounded-2xl shadow-xl p-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-6">Message Activity Over Time</h2>
                
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={Object.keys(analysis.stats.messagesByMonth).sort().map(month => ({
                    month,
                    messages: analysis.stats.messagesByMonth[month].length
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="month" 
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="messages" 
                      stroke="#8b5cf6" 
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Relationship Phases */}
            {analysis.relationshipPhases && analysis.relationshipPhases.length > 0 && (
              <div className="bg-white rounded-2xl shadow-xl p-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-6">Relationship Phases</h2>
                
                <div className="space-y-4">
                  {analysis.relationshipPhases.map((phase, idx) => (
                    <div key={idx} className="border-l-4 border-purple-500 pl-4 py-2">
                      <h3 className="font-bold text-lg text-gray-800">{phase.period}</h3>
                      <p className="text-gray-700 mt-2">{phase.description}</p>
                      <div className="mt-2">
                        <span className="text-sm font-semibold text-purple-600">Emotional Tone: </span>
                        <span className="text-sm text-gray-600">{phase.emotionalTone}</span>
                      </div>
                      {phase.keyThemes && phase.keyThemes.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {phase.keyThemes.map((theme, tidx) => (
                            <span key={tidx} className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                              {theme}
                            </span>
                          ))}
                        </div>
                      )}
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
          </div>
        )}
      </div>
    </div>
  );
};

export default MessengerAnalysis;
