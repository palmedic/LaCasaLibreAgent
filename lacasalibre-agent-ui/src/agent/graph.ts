import { StateGraph, MessagesAnnotation, START, END } from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { ChatOpenAI } from '@langchain/openai';
import { AIMessage, BaseMessage, SystemMessage } from '@langchain/core/messages';
import { homeAssistantTools } from '@/tools/haTools';
import { discogsTools } from '@/tools/discogsTools';
import { AgentTracer } from './tracing';
import { validateEnv } from '@/config/env';
import { HOUSE_SYSTEM_MESSAGE } from '@/config/houseContext';

// Validate environment on module load
const env = validateEnv();

// Helper to check if system message already exists
function hasSystemMessage(messages: BaseMessage[]): boolean {
  return messages.length > 0 && messages[0]._getType() === 'system';
}

// Helper to prepend system message if needed
function ensureSystemMessage(messages: BaseMessage[]): BaseMessage[] {
  if (hasSystemMessage(messages)) {
    return messages;
  }
  return [new SystemMessage(HOUSE_SYSTEM_MESSAGE), ...messages];
}

// Combine all tools
const allTools = [...homeAssistantTools, ...discogsTools];

// Initialize the model with tools
const model = new ChatOpenAI({
  modelName: 'gpt-4o',
  temperature: 0,
  openAIApiKey: env.OPENAI_API_KEY,
}).bindTools(allTools);

// Define the function that determines whether to continue or end
function shouldContinue(state: typeof MessagesAnnotation.State) {
  const messages = state.messages;
  const lastMessage = messages[messages.length - 1] as AIMessage;

  // If there are tool calls, continue to the tools node
  if (lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
    return 'tools';
  }
  // Otherwise, end
  return END;
}

// Define the agent node that calls the model
async function callModel(state: typeof MessagesAnnotation.State) {
  const messages = state.messages;
  const messagesWithContext = ensureSystemMessage(messages);

  console.log('[Agent] Invoking model with', messagesWithContext.length, 'messages');
  const response = await model.invoke(messagesWithContext);

  const aiMsg = response as AIMessage;
  if (aiMsg.tool_calls && aiMsg.tool_calls.length > 0) {
    console.log('[Agent] Model requested', aiMsg.tool_calls.length, 'tool calls:',
      aiMsg.tool_calls.map(tc => tc.name));
  } else {
    console.log('[Agent] Model responded without tool calls');
  }

  return { messages: [response] };
}

// Build the graph
const workflow = new StateGraph(MessagesAnnotation)
  .addNode('agent', callModel)
  .addNode('tools', new ToolNode(allTools))
  .addEdge(START, 'agent')
  .addConditionalEdges('agent', shouldContinue, {
    tools: 'tools',
    [END]: END,
  })
  .addEdge('tools', 'agent');

const graph = workflow.compile();

// Execute the agent and capture trace
export async function runAgent(
  messages: BaseMessage[],
  tracer: AgentTracer
): Promise<string> {
  try {
    // Ensure system message is included
    const messagesWithContext = ensureSystemMessage(messages);

    // Trace the messages being sent to LLM
    const simplifiedMessages = messagesWithContext.map(msg => ({
      role: msg._getType() === 'human' ? 'user' : msg._getType() === 'ai' ? 'assistant' : msg._getType(),
      content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
    }));
    tracer.addLLMPrompt(simplifiedMessages);

    const result = await graph.invoke({
      messages: messagesWithContext,
    });

    const resultMessages = result.messages as BaseMessage[];

    // Trace all messages
    for (const msg of resultMessages) {
      if (msg._getType() === 'human') {
        // Skip - already traced by caller
        continue;
      } else if (msg._getType() === 'ai') {
        const aiMsg = msg as AIMessage;

        // Check if this AI message has tool calls
        if (aiMsg.tool_calls && aiMsg.tool_calls.length > 0) {
          for (const toolCall of aiMsg.tool_calls) {
            tracer.addToolCall(toolCall.name, toolCall.args as Record<string, unknown>);
          }
        } else if (aiMsg.content) {
          // Only add assistant message if it has content and no tool calls
          tracer.addAssistantMessage(String(aiMsg.content));
        }
      } else if (msg._getType() === 'tool') {
        const toolMsg = msg as { name?: string; content: string };
        const toolName = toolMsg.name || 'unknown';
        try {
          const parsedResult = JSON.parse(toolMsg.content);
          tracer.addToolResult(toolName, parsedResult);
        } catch {
          tracer.addToolResult(toolName, toolMsg.content);
        }
      }
    }

    // Get the last AI message as the final response
    const lastAIMessage = [...resultMessages]
      .reverse()
      .find((msg) => msg._getType() === 'ai') as AIMessage | undefined;

    return lastAIMessage?.content ? String(lastAIMessage.content) : 'No response generated.';
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    tracer.addError(errorMessage);
    throw error;
  }
}

// Streaming version that emits events as they happen
export async function runAgentStreaming(
  messages: BaseMessage[],
  onEvent: (event: import('./tracing').TraceEvent) => void
): Promise<string> {
  let stepCounter = 1; // Start at 1, user message is 0

  try {
    // Ensure system message is included
    const messagesWithContext = ensureSystemMessage(messages);

    // Emit LLM prompt event
    const simplifiedMessages = messagesWithContext.map(msg => ({
      role: msg._getType() === 'human' ? 'user' : msg._getType() === 'ai' ? 'assistant' : msg._getType(),
      content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
    }));

    onEvent({
      step: stepCounter++,
      type: 'LLM_PROMPT',
      timestamp: new Date().toISOString(),
      content: `Sending ${simplifiedMessages.length} messages to LLM`,
      messages: simplifiedMessages,
    });

    // Stream the graph execution
    const stream = await graph.stream({
      messages: messagesWithContext,
    });

    let allMessages: BaseMessage[] = [];

    for await (const chunk of stream) {
      // Extract messages from the chunk
      if (chunk.agent?.messages) {
        const newMessages = chunk.agent.messages as BaseMessage[];

        for (const msg of newMessages) {
          if (msg._getType() === 'ai') {
            const aiMsg = msg as AIMessage;

            // Check if this AI message has tool calls
            if (aiMsg.tool_calls && aiMsg.tool_calls.length > 0) {
              for (const toolCall of aiMsg.tool_calls) {
                onEvent({
                  step: stepCounter++,
                  type: 'TOOL_CALL',
                  timestamp: new Date().toISOString(),
                  content: `Calling tool: ${toolCall.name}`,
                  toolName: toolCall.name,
                  toolArgs: toolCall.args as Record<string, unknown>,
                });
              }
            } else if (aiMsg.content) {
              onEvent({
                step: stepCounter++,
                type: 'ASSISTANT',
                timestamp: new Date().toISOString(),
                content: String(aiMsg.content),
              });
            }
          }
        }

        allMessages = [...allMessages, ...newMessages];
      }

      if (chunk.tools?.messages) {
        const toolMessages = chunk.tools.messages as BaseMessage[];

        for (const msg of toolMessages) {
          if (msg._getType() === 'tool') {
            const toolMsg = msg as { name?: string; content: string };
            const toolName = toolMsg.name || 'unknown';
            try {
              const parsedResult = JSON.parse(toolMsg.content);
              onEvent({
                step: stepCounter++,
                type: 'TOOL_RESULT',
                timestamp: new Date().toISOString(),
                content: `Tool ${toolName} completed`,
                toolName,
                toolResult: parsedResult,
              });
            } catch {
              onEvent({
                step: stepCounter++,
                type: 'TOOL_RESULT',
                timestamp: new Date().toISOString(),
                content: `Tool ${toolName} completed`,
                toolName,
                toolResult: toolMsg.content,
              });
            }
          }
        }

        allMessages = [...allMessages, ...toolMessages];
      }
    }

    // Get the last AI message as the final response
    const lastAIMessage = [...allMessages]
      .reverse()
      .find((msg) => msg._getType() === 'ai') as AIMessage | undefined;

    return lastAIMessage?.content ? String(lastAIMessage.content) : 'No response generated.';
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    onEvent({
      step: stepCounter++,
      type: 'ERROR',
      timestamp: new Date().toISOString(),
      content: errorMessage,
      error: errorMessage,
    });
    throw error;
  }
}

export { graph };
