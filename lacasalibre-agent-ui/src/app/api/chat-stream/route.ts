import { HumanMessage, AIMessage, BaseMessage } from '@langchain/core/messages';
import { runAgentStreaming } from '@/agent/graph';
import { TraceEvent } from '@/agent/tracing';
import { randomUUID } from 'crypto';
import { initializeServer } from '@/server/init';

// In-memory thread storage (shared with non-streaming endpoint)
const threadStorage = new Map<string, BaseMessage[]>();

interface ChatRequest {
  message: string;
  threadId?: string;
}

export async function POST(request: Request) {
  // Initialize server on first request
  await initializeServer();

  const body: ChatRequest = await request.json();
  const { message, threadId: inputThreadId } = body;

  if (!message || typeof message !== 'string') {
    return new Response(
      JSON.stringify({ error: 'Message is required and must be a string' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Get or create thread
  const threadId = inputThreadId || randomUUID();
  const existingMessages = threadStorage.get(threadId) || [];

  // Build messages array
  const messages: BaseMessage[] = [
    ...existingMessages,
    new HumanMessage(message),
  ];

  // Create a ReadableStream for SSE
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Send initial user message event
        const userEvent: TraceEvent = {
          step: 0,
          type: 'USER',
          timestamp: new Date().toISOString(),
          content: message,
        };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(userEvent)}\n\n`));

        // Callback to stream trace events
        const onTraceEvent = (event: TraceEvent) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        };

        // Run the agent with streaming
        const reply = await runAgentStreaming(messages, onTraceEvent);

        // Update thread storage
        const updatedMessages = [
          ...messages,
          new AIMessage(reply),
        ];
        threadStorage.set(threadId, updatedMessages);

        // Send completion event with threadId
        const doneEvent = {
          type: 'DONE',
          threadId,
          reply,
        };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(doneEvent)}\n\n`));

        controller.close();
      } catch (error) {
        console.error('Error in streaming route:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

        const errorEvent = {
          type: 'ERROR',
          error: errorMessage,
        };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorEvent)}\n\n`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

// Export the same DELETE handler for clearing threads
export { DELETE } from '../chat/route';
