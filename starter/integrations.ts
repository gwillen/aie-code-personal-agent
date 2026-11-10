// This is the attendee's exercise file. Work through TODOs 1–5 in order.
// Transport, persistence, validation, and the bounded agent loop are supplied.
// Complete provider adapters live in ../src/ for reference.
import { complete, type Complete } from '../src/model.ts';
import type { Browse } from '../src/browser.ts';
import type { PersonalMemory } from '../src/memory.ts';
import type { Store } from '../src/store.ts';
import type { Send } from '../src/worker.ts';

export class IntegrationIncomplete extends Error {
  constructor(step: number, component: string) {
    super(`TODO ${step}: connect ${component} in starter/integrations.ts. See docs/WORKSHOP.md.`);
  }
}

// TODO 1 — MODEL (done): forward to the supplied OpenAI-compatible transport,
// which POSTs to MODEL_BASE_URL/chat/completions and returns the assistant message.
export const callModel: Complete = (messages, tools, signal) => complete(messages, tools, signal);

export async function searchWeb(_query: string, _signal: AbortSignal): Promise<unknown> {
  // TODO 2 — EXA
  // Implement POST https://api.exa.ai/search with your EXA_API_KEY.
  // Request contents: { highlights: true }; preserve URLs and bound the results.
  // See search() in ../src/agent.ts for the complete reference implementation.
  throw new IntegrationIncomplete(2, 'Exa');
}

export const readPage: Browse = async (_url, _question, _signal) => {
  // TODO 3 — KERNEL
  // Connect the browse() adapter in ../src/browser.ts to this tool callback.
  // Read its create → execute → delete lifecycle; retain its validation/cleanup.
  throw new IntegrationIncomplete(3, 'Kernel');
};

export function connectMemory(_store: Store): PersonalMemory {
  // TODO 4 — MEM0
  // Return the personalMemory(store) adapter from ../src/memory.ts.
  // Its list/search/remember/forget methods share one owner scope.
  throw new IntegrationIncomplete(4, 'Mem0');
}

export const deliverReply: Send = async (_chat, _text, _idempotencyKey, _request) => {
  // TODO 5 — LINQ
  // Connect sendReply() in ../src/linq.ts with config.linqKey.
  // Forward the original chat, reply, and stable idempotency key.
  // For the text-only baseline, use sendReply(key, chat, text, idempotencyKey, fetch, []).
  // In TODO 6, replace [] with sourceCards(text).
  // Default is one card. To allow explicitly requested extras, import sourceCardLimit
  // from ../src/response.ts and pass sourceCardLimit(_request) as the seventh argument.
  throw new IntegrationIncomplete(5, 'Linq reply delivery');
};

export function sourceCards(_text: string): string[] {
  // TODO 6 — FEATURE: source preview cards.
  // Extract up to three distinct public HTTPS URLs from the reply, preferring
  // returned Exa Library URLs. The transport defaults to a summary plus ONE card.
  // Preserve balanced URL parentheses; strip surrounding Markdown/prose punctuation.
  // Connect this to sendReply's sixth argument after verifying the baseline.
  // The supplied src/linq.ts replyLinks() is the complete reference implementation.
  return [];
}
