// This is the attendee's exercise file. Work through TODOs 1–5 in order.
// Transport, persistence, validation, and the bounded agent loop are supplied.
// Complete provider adapters live in ../src/ for reference.
import { complete, type Complete } from '../src/model.ts';
import { config } from '../src/config.ts';
import { browse, type Browse } from '../src/browser.ts';
import { personalMemory, type PersonalMemory } from '../src/memory.ts';
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

// TODO 2 — EXA (done): POST https://api.exa.ai/search with highlights.
// Docs: https://exa.ai/docs/reference/search, https://exa.ai/docs/search/highlights
const exaSearchUrl = 'https://api.exa.ai/search';
// Bounds on what one search can put into the model's context.
const evidenceLimits = { results: 5, highlightsPerResult: 3, highlightChars: 1200, titleChars: 200, urlChars: 2048 };

type ExaResult = { title?: unknown; url?: unknown; highlights?: unknown };
export type SearchEvidence = { title: string; url: string; highlights: string[] };

// URLs are kept intact (a truncated URL is a broken citation), so results
// without a usable URL are dropped rather than trimmed.
function hasUsableUrl(item: ExaResult): item is ExaResult & { url: string } {
  return typeof item.url === 'string' && item.url.length > 0 && item.url.length <= evidenceLimits.urlChars;
}

function boundEvidence(item: ExaResult & { url: string }): SearchEvidence {
  const highlights = Array.isArray(item.highlights) ? item.highlights : [];
  return {
    title: String(item.title ?? '').slice(0, evidenceLimits.titleChars),
    url: item.url,
    highlights: highlights.filter((text): text is string => typeof text === 'string')
      .slice(0, evidenceLimits.highlightsPerResult).map(text => text.slice(0, evidenceLimits.highlightChars)),
  };
}

function requestExaSearch(query: string, signal: AbortSignal): Promise<Response> {
  return fetch(exaSearchUrl, {
    method: 'POST',
    headers: { 'x-api-key': config.exaKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, type: 'auto', numResults: evidenceLimits.results, contents: { highlights: true } }),
    signal: AbortSignal.any([signal, AbortSignal.timeout(20_000)]), redirect: 'error',
  });
}

// The agent loop hides tool errors from the terminal (the model just sees
// "tool unavailable"), so log the cause here before rethrowing.
function searchFailed(reason: string): Error {
  console.error(`${new Date().toISOString()} [starter] Exa search failed: ${reason}`);
  return new Error(`Exa search failed: ${reason}`);
}

export async function searchWeb(query: string, signal: AbortSignal): Promise<unknown> {
  const response = await requestExaSearch(query, signal);
  if (!response.ok) {
    await response.body?.cancel().catch(() => {});
    throw searchFailed(`HTTP ${response.status}`);
  }
  const data = await response.json() as { results?: unknown };
  if (!Array.isArray(data.results)) throw searchFailed('response has no results array');
  const results = (data.results as ExaResult[]).filter(hasUsableUrl).slice(0, evidenceLimits.results).map(boundEvidence);
  return { retrievedAt: new Date().toISOString(), results };
}

// TODO 3 — KERNEL (done): forward unchanged to the supplied browse() adapter.
// It validates the URL (public HTTPS hostname only), creates a Kernel browser
// whose egress is limited to that host, runs fixed read-only Playwright code,
// rejects off-host redirects, and always deletes the session (60s timeout backstop).
// Docs: https://www.kernel.sh/docs/introduction/create
export const readPage: Browse = (url, question, signal) => browse(url, question, signal);

// TODO 4 — MEM0 (done): return the supplied Mem0 OSS adapter (one cached
// instance per store). Each call runs a short-lived worker over local files in
// DATA_DIR/mem0/<sha256(owner)>/, using the model endpoint for fact extraction
// and embeddings. Docs: https://docs.mem0.ai/open-source/node-quickstart
export function connectMemory(store: Store): PersonalMemory {
  return personalMemory(store);
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
