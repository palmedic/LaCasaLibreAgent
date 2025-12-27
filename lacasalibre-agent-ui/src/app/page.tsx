'use client';

import { useState, useRef, useEffect, FormEvent } from 'react';
import Image from 'next/image';
import './globals.css';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  images?: string[]; // Base64 image data URIs
}

interface TraceEvent {
  step: number;
  type: 'USER' | 'ASSISTANT' | 'TOOL_CALL' | 'TOOL_RESULT' | 'ERROR' | 'LLM_PROMPT' | 'IMAGE';
  timestamp: string;
  content: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolResult?: unknown;
  error?: string;
  messages?: Array<{ role: string; content: string }>;
  imageData?: string; // Base64 image data for IMAGE events
}

// Format message content to fix numbered lists
function formatMessageContent(content: string): string {
  // Fix numbered lists that are on one line: "1. Item 2. Item 3. Item"
  // Convert to proper line breaks: "1. Item\n2. Item\n3. Item"

  // Pattern: digit(s) followed by period and space, but not at start of line
  const numberedListPattern = /(\s+)(\d+\.\s+)/g;

  // Replace inline numbered list items with line breaks
  let formatted = content.replace(numberedListPattern, '\n$2');

  // Clean up: if we created double line breaks, reduce to single
  formatted = formatted.replace(/\n{3,}/g, '\n\n');

  return formatted;
}

// Extract images from IMAGE events in trace
function extractImagesFromTrace(events: TraceEvent[]): string[] {
  const images: string[] = [];

  for (const event of events) {
    // Look for dedicated IMAGE events (more efficient - image not sent to LLM)
    if (event.type === 'IMAGE' && event.imageData) {
      console.log('[extractImages] Found IMAGE event from:', event.toolName);
      console.log('[extractImages] Image length:', event.imageData.length);
      images.push(event.imageData);
    }
  }

  console.log('[extractImages] Total images found:', images.length);
  return images;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [trace, setTrace] = useState<TraceEvent[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());
  const [showTrace, setShowTrace] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const traceEndRef = useRef<HTMLDivElement>(null);

  const toggleStep = (idx: number) => {
    setExpandedSteps(prev => {
      const newSet = new Set(prev);
      if (newSet.has(idx)) {
        newSet.delete(idx);
      } else {
        newSet.add(idx);
      }
      return newSet;
    });
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    traceEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, trace]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setError(null);

    // Add user message to UI
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);

    setLoading(true);

    try {
      // Use streaming endpoint
      const response = await fetch('/api/chat-stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage,
          threadId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to connect to chat stream');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('Response body is not readable');
      }

      let buffer = '';
      const collectedEvents: TraceEvent[] = []; // Collect events locally to extract images

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));

            if (data.type === 'DONE') {
              // Update thread ID
              if (data.threadId && !threadId) {
                setThreadId(data.threadId);
              }

              // Extract any images from the collected trace events
              console.log('[DONE] Collected events count:', collectedEvents.length);
              const images = extractImagesFromTrace(collectedEvents);
              console.log('[DONE] Images extracted:', images.length);
              if (images.length > 0) {
                console.log('[DONE] First image length:', images[0].length);
              }

              // Add assistant response to messages with any images
              setMessages((prev) => [
                ...prev,
                { role: 'assistant', content: data.reply, images: images.length > 0 ? images : undefined },
              ]);
            } else if (data.type === 'ERROR') {
              throw new Error(data.error);
            } else {
              // Regular trace event - add to trace in real-time and collect locally
              collectedEvents.push(data);
              setTrace((prev) => [...prev, data]);
            }
          }
        }
      }
    } catch (err) {
      console.error('Error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Error: ${errorMessage}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const renderTraceData = (event: TraceEvent) => {
    if (event.messages) {
      return (
        <div className="trace-data">
          <strong>Messages sent to LLM:</strong>
          {event.messages.map((msg, idx) => (
            <div key={idx} style={{ marginTop: '8px', paddingLeft: '8px', borderLeft: '2px solid #ddd' }}>
              <div style={{ fontWeight: 'bold', color: '#666', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                {msg.role}
              </div>
              <pre style={{ marginTop: '4px', whiteSpace: 'pre-wrap' }}>{msg.content}</pre>
            </div>
          ))}
        </div>
      );
    }

    if (event.toolArgs) {
      return (
        <div className="trace-data">
          <strong>Arguments:</strong>
          <pre>{JSON.stringify(event.toolArgs, null, 2)}</pre>
        </div>
      );
    }

    if (event.toolResult) {
      return (
        <div className="trace-data">
          <strong>Result:</strong>
          <pre>{JSON.stringify(event.toolResult, null, 2)}</pre>
        </div>
      );
    }

    if (event.error) {
      return (
        <div className="trace-data">
          <strong>Error:</strong>
          <pre>{event.error}</pre>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="container">
      <main className="main">
        {/* Chat Panel */}
        <div className="chat-panel">
          <div className="panel-header">
            <h2>Conversation</h2>
            <button
              className="trace-toggle-button"
              onClick={() => setShowTrace(!showTrace)}
              aria-label="Toggle execution trace"
            >
              {showTrace ? '✕' : '🔍'} Trace
            </button>
          </div>

          <div className={`messages ${messages.length === 0 ? 'messages-empty' : ''}`}>
            {messages.length === 0 ? (
              <div className="empty-state">
                <Image
                  src="/LaCasaLibreLogo.png"
                  alt="La Casa Libre"
                  width={720}
                  height={400}
                  className="empty-state-logo"
                  priority
                />
              </div>
            ) : (
              messages.map((msg, idx) => {
                if (msg.images && msg.images.length > 0) {
                  console.log('[Render] Message', idx, 'has', msg.images.length, 'images');
                  console.log('[Render] First image length:', msg.images[0].length);
                }
                return (
                  <div key={idx} className={`message ${msg.role}`}>
                    {formatMessageContent(msg.content)}
                    {msg.images && msg.images.length > 0 && (
                      <div className="message-images">
                        {msg.images.map((img, imgIdx) => (
                          <img
                            key={imgIdx}
                            src={img}
                            alt={`Camera snapshot ${imgIdx + 1}`}
                            className="message-image"
                            onError={(e) => console.error('[Render] Image failed to load:', imgIdx, e)}
                            onLoad={() => console.log('[Render] Image loaded successfully:', imgIdx)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="input-area">
            {error && <div className="error-message">{error}</div>}
            <form onSubmit={handleSubmit} className="input-form">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="How can I help you today?"
                className="input-field"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="send-button"
              >
                {loading ? 'Sending...' : 'Send'}
              </button>
            </form>
          </div>
        </div>

        {/* Trace Panel */}
        <div className={`trace-panel ${showTrace ? 'trace-panel-visible' : ''}`}>
          <div className="panel-header">
            <h2>Execution Trace</h2>
            <button
              className="trace-close-button"
              onClick={() => setShowTrace(false)}
              aria-label="Close execution trace"
            >
              ✕
            </button>
          </div>

          <div className="trace-list">
            {trace.length === 0 ? (
              <div className="empty-state">
                Execution trace will appear here
              </div>
            ) : (
              trace.map((event, idx) => {
                const isExpanded = expandedSteps.has(idx);
                return (
                  <div key={idx} className={`trace-event ${event.type}`}>
                    <div className="trace-header" onClick={() => toggleStep(idx)} style={{ cursor: 'pointer' }}>
                      <span className="trace-expand-icon">
                        {isExpanded ? '▼' : '▶'}
                      </span>
                      <span className="trace-step">Step {event.step}</span>
                      <span className={`trace-badge ${event.type}`}>
                        {event.type}
                      </span>
                      {event.toolName && (
                        <span style={{ fontSize: '0.8rem', color: '#666' }}>
                          {event.toolName}
                        </span>
                      )}
                    </div>
                    {isExpanded && (
                      <>
                        <div className="trace-content">{event.content}</div>
                        {renderTraceData(event)}
                      </>
                    )}
                  </div>
                );
              })
            )}
            <div ref={traceEndRef} />
          </div>
        </div>
      </main>
    </div>
  );
}
