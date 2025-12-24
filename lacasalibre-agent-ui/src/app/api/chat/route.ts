import { NextRequest, NextResponse } from 'next/server';
import { HumanMessage, AIMessage, BaseMessage } from '@langchain/core/messages';
import { runAgent } from '@/agent/graph';
import { AgentTracer, TraceEvent } from '@/agent/tracing';
import { randomUUID } from 'crypto';

// In-memory thread storage (will reset when dev server restarts)
// In production, you'd want to use a database or Redis
const threadStorage = new Map<string, BaseMessage[]>();

interface ChatRequest {
  message: string;
  threadId?: string;
}

interface ChatResponse {
  reply: string;
  trace: TraceEvent[];
  threadId: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json();
    const { message, threadId: inputThreadId } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required and must be a string' },
        { status: 400 }
      );
    }

    // Get or create thread
    const threadId = inputThreadId || randomUUID();
    const existingMessages = threadStorage.get(threadId) || [];

    // Create tracer
    const tracer = new AgentTracer();

    // Add user message to trace
    tracer.addUserMessage(message);

    // Build messages array
    const messages: BaseMessage[] = [
      ...existingMessages,
      new HumanMessage(message),
    ];

    // Run the agent
    const reply = await runAgent(messages, tracer);

    // Update thread storage with new messages
    const updatedMessages = [
      ...messages,
      new AIMessage(reply),
    ];
    threadStorage.set(threadId, updatedMessages);

    // Get trace events
    const trace = tracer.getEvents();

    const response: ChatResponse = {
      reply,
      trace,
      threadId,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in chat route:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    return NextResponse.json(
      {
        error: errorMessage,
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

// Optional: Add a DELETE endpoint to clear a thread
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const threadId = searchParams.get('threadId');

    if (!threadId) {
      return NextResponse.json(
        { error: 'threadId parameter is required' },
        { status: 400 }
      );
    }

    threadStorage.delete(threadId);

    return NextResponse.json({ success: true, message: 'Thread cleared' });
  } catch (error) {
    console.error('Error deleting thread:', error);
    return NextResponse.json(
      { error: 'Failed to delete thread' },
      { status: 500 }
    );
  }
}
