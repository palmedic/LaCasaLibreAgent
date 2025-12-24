'use client';

import { useState, useRef, useEffect, FormEvent } from 'react';
import './globals.css';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface TraceEvent {
  step: number;
  type: 'USER' | 'ASSISTANT' | 'TOOL_CALL' | 'TOOL_RESULT' | 'ERROR' | 'LLM_PROMPT';
  timestamp: string;
  content: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolResult?: unknown;
  error?: string;
  messages?: Array<{ role: string; content: string }>;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [trace, setTrace] = useState<TraceEvent[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());

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

              // Add assistant response to messages
              setMessages((prev) => [
                ...prev,
                { role: 'assistant', content: data.reply },
              ]);
            } else if (data.type === 'ERROR') {
              throw new Error(data.error);
            } else {
              // Regular trace event - add to trace in real-time
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
      <header className="header">
        <h1>La Casa Libre</h1>
      </header>

      <main className="main">
        {/* Chat Panel */}
        <div className="chat-panel">
          <div className="panel-header">
            <h2>Conversation</h2>
          </div>

          <div className="messages">
            {messages.length === 0 ? (
              <div className="empty-state">
                How can I help you today?
              </div>
            ) : (
              messages.map((msg, idx) => (
                <div key={idx} className={`message ${msg.role}`}>
                  {msg.content}
                </div>
              ))
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
        <div className="trace-panel">
          <div className="panel-header">
            <h2>Execution Trace</h2>
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
