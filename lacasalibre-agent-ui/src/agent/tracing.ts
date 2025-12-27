// Tracing types and utilities for the agent execution

export type TraceEventType =
  | 'USER'
  | 'ASSISTANT'
  | 'TOOL_CALL'
  | 'TOOL_RESULT'
  | 'ERROR'
  | 'LLM_PROMPT'
  | 'IMAGE';

export interface TraceEvent {
  step: number;
  type: TraceEventType;
  timestamp: string;
  content: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolResult?: unknown;
  error?: string;
  messages?: Array<{ role: string; content: string }>;
  imageData?: string; // Base64 image data for IMAGE events
}

export class AgentTracer {
  private events: TraceEvent[] = [];
  private stepCounter = 0;

  addUserMessage(content: string): void {
    this.events.push({
      step: this.stepCounter++,
      type: 'USER',
      timestamp: new Date().toISOString(),
      content,
    });
  }

  addAssistantMessage(content: string): void {
    this.events.push({
      step: this.stepCounter++,
      type: 'ASSISTANT',
      timestamp: new Date().toISOString(),
      content,
    });
  }

  addToolCall(toolName: string, toolArgs: Record<string, unknown>): void {
    this.events.push({
      step: this.stepCounter++,
      type: 'TOOL_CALL',
      timestamp: new Date().toISOString(),
      content: `Calling tool: ${toolName}`,
      toolName,
      toolArgs,
    });
  }

  addToolResult(toolName: string, result: unknown): void {
    this.events.push({
      step: this.stepCounter++,
      type: 'TOOL_RESULT',
      timestamp: new Date().toISOString(),
      content: `Tool ${toolName} completed`,
      toolName,
      toolResult: result,
    });
  }

  addError(error: string): void {
    this.events.push({
      step: this.stepCounter++,
      type: 'ERROR',
      timestamp: new Date().toISOString(),
      content: error,
      error,
    });
  }

  addLLMPrompt(messages: Array<{ role: string; content: string }>): void {
    this.events.push({
      step: this.stepCounter++,
      type: 'LLM_PROMPT',
      timestamp: new Date().toISOString(),
      content: `Sending ${messages.length} messages to LLM`,
      messages,
    });
  }

  getEvents(): TraceEvent[] {
    return this.events;
  }

  clear(): void {
    this.events = [];
    this.stepCounter = 0;
  }
}
