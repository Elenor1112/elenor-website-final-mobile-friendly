import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getAiConfig, isChatConfigured } from '@/server/ai/config';
import { runChatTurn, type ChatTurnEvent } from '@/server/ai/chat/chat-service';
import {
  getOrCreateConversation,
  loadConversationHistory,
  recordAnalytics,
  recordAssistantMessage,
  recordUserMessage,
  safely,
  syncLead,
} from '@/server/ai/chat/conversation-store';
import { checkRateLimit } from '@/server/ai/chat/rate-limit';
import { clientIp, hitRateLimit } from '@/server/rate-limit';
import { chatSessionCookie, resolveChatSession } from '@/server/ai/chat/session';

// Streaming requires the Node runtime (the DB driver and crypto are used here).
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const messageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(8000),
});

/**
 * Client-supplied history is a *hint* used only when the server has no stored
 * conversation (e.g. the visitor cleared cookies but kept localStorage). When
 * a server-side conversation exists it always wins, so a tampered payload
 * cannot rewrite what the assistant believes was said.
 */
const requestSchema = z.object({
  message: z.string().trim().min(1, 'Please enter a message.'),
  conversation: z.array(messageSchema).max(40).default([]),
});

function errorResponse(message: string, status: number, extraHeaders?: HeadersInit) {
  return NextResponse.json({ error: message }, { status, headers: extraHeaders });
}

export async function POST(request: NextRequest) {
  if (!isChatConfigured()) {
    return errorResponse(
      'The assistant is not configured yet. Please contact our team directly.',
      503,
    );
  }

  const config = getAiConfig();

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return errorResponse('Invalid request body.', 400);
  }

  const parsed = requestSchema.safeParse(payload);
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? 'Invalid request.', 400);
  }

  const { message, conversation } = parsed.data;
  if (message.length > config.limits.maxQuestionChars) {
    return errorResponse(
      `Please keep your message under ${config.limits.maxQuestionChars} characters.`,
      400,
    );
  }

  const session = resolveChatSession();
  // IP-only: the session comes from a cookie the client can drop to get a
  // fresh bucket on every request. The DB counter holds across instances; the
  // in-memory one keeps a per-instance cap if the database is unreachable.
  const ip = clientIp(request.headers);
  const limitOptions = {
    limit: config.limits.rateLimitRequests,
    windowMs: config.limits.rateLimitWindowMs,
  };
  const limit =
    (await safely(() => hitRateLimit(`chat:${ip}`, limitOptions), 'hitRateLimit')) ??
    checkRateLimit(ip, limitOptions);
  if (!limit.allowed) {
    return errorResponse('You are sending messages too quickly. Please wait a moment.', 429, {
      'retry-after': String(limit.retryAfterSeconds),
    });
  }

  // Persistence is optional — if the database is unreachable the assistant
  // still answers, it just doesn't remember (Phase 1 behaviour).
  const conversationId = await safely(
    () =>
      getOrCreateConversation(session.key, {
        referrer: request.headers.get('referer')?.slice(0, 500) ?? '',
      }),
    'getOrCreateConversation',
  );

  let history = conversationId
    ? (await safely(
        () => loadConversationHistory(conversationId, config.limits.maxHistoryMessages),
        'loadConversationHistory',
      )) ?? []
    : [];

  // Fall back to the client's copy only when the server has nothing stored.
  if (history.length === 0 && conversation.length > 0) {
    history = conversation.slice(-config.limits.maxHistoryMessages);
  }

  if (conversationId) {
    await safely(() => recordUserMessage(conversationId, message), 'recordUserMessage');
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: ChatTurnEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      try {
        for await (const event of runChatTurn({
          question: message,
          history,
          signal: request.signal,
        })) {
          send(event);

          if (event.type === 'done' && conversationId) {
            // Persist after the stream is complete so logging latency never
            // delays a token reaching the browser.
            await safely(
              () => recordAssistantMessage(conversationId, event.summary),
              'recordAssistantMessage',
            );
            await safely(
              () => recordAnalytics(conversationId, message, event.summary),
              'recordAnalytics',
            );
            await safely(() => syncLead(conversationId), 'syncLead');
          }
        }
      } catch (error) {
        // The service handles provider failures internally; reaching here means
        // something unexpected broke, so close the stream gracefully.
        if (!request.signal.aborted) {
          console.error('[elenor-ai] Chat stream failed:', error);
          send({
            type: 'error',
            code: 'stream_failed',
            message:
              'Something went wrong on our side. Please try again, or contact our team directly.',
          });
        }
      } finally {
        controller.close();
      }
    },
  });

  const headers = new Headers({
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache, no-transform',
    connection: 'keep-alive',
    // Disable proxy buffering so tokens arrive as they are produced.
    'x-accel-buffering': 'no',
  });
  if (session.isNew) headers.append('set-cookie', chatSessionCookie(session.token));

  return new Response(stream, { headers });
}
