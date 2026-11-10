// Telegram Bot API channel: long polling (no public webhook or tunnel needed),
// owner-only private text messages, text replies with native link previews.
// Docs: https://core.telegram.org/bots/api
import { createHash } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import type { Job, Store } from './store.ts';
import { DeliveryReviewRequired } from './worker.ts';
import { whatsappTextParts } from './whatsapp.ts';

export type TelegramSettings = { token: string; ownerId: string; scope: string };
export type TelegramUser = { id: number; is_bot?: boolean; username?: string; first_name?: string };
export type TelegramUpdate = {
  update_id: number;
  message?: { message_id: number; from?: TelegramUser; chat: { id: number; type: string }; text?: string };
};
type NewJob = Pick<Job, 'id' | 'event_id' | 'chat' | 'sender' | 'text'>;

export function log(level: 'info' | 'error', message: string): void {
  console[level](`${new Date().toISOString()} [telegram] ${message}`);
}

// Telegram answered and refused the call, so nothing happened: safe to retry.
export class TelegramRejected extends Error {
  code: number;
  constructor(method: string, code: number, description = '') {
    super(`Telegram ${method} rejected (${code}${description ? `: ${description}` : ''})`);
    this.code = code;
  }
}
// No usable answer (network error, timeout, garbled response): outcome unknown.
export class TelegramUnreachable extends Error {
  constructor(method: string, reason: string) { super(`Telegram ${method} unreachable (${reason})`); }
}

// The bot token is part of the URL, so errors are rebuilt here without it.
export async function telegramCall<T>(token: string, method: string, body: object, signal: AbortSignal, request: typeof fetch = fetch): Promise<T> {
  let response: Response;
  try {
    response = await request(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal, redirect: 'error',
    });
  } catch (error) { throw new TelegramUnreachable(method, (error as Error).name); }
  const data = await response.json().catch(() => null) as { ok?: boolean; result?: T; error_code?: number; description?: string } | null;
  if (data?.ok === true) return data.result as T;
  if (typeof data?.error_code === 'number') throw new TelegramRejected(method, data.error_code, data.description);
  throw new TelegramUnreachable(method, `HTTP ${response.status}`);
}

export const telegramChat = (userId: string | number) => `telegram:${userId}`;
const chatId = (chat: string) => chat.slice('telegram:'.length);

// Only the owner's private text messages become jobs. In a private chat the
// chat ID equals the user ID. Memory/history use the shared owner scope.
export function telegramJobs(update: TelegramUpdate, settings: TelegramSettings): NewJob[] {
  const message = update.message;
  if (!message || message.chat?.type !== 'private' || message.from?.is_bot || String(message.from?.id) !== settings.ownerId) return [];
  const text = typeof message.text === 'string' ? message.text.trim() : '';
  if (!text) return [];
  const id = `telegram:${message.chat.id}:${message.message_id}`;
  return [{ id, event_id: id, chat: telegramChat(message.chat.id), sender: settings.scope, text: text.length > 8000 ? '/too-long' : text }];
}

function describeIgnored(update: TelegramUpdate): string {
  const message = update.message;
  return `Ignored update ${update.update_id} (from user ${message?.from?.id ?? 'unknown'}, chat type ${message?.chat?.type ?? 'none'}, ` +
    `${typeof message?.text === 'string' ? 'text' : 'non-text'}); only TELEGRAM_OWNER_ID's private text messages are answered.`;
}

// Returns whether any new job was queued. Duplicates (redelivered updates) are ignored by the store.
export function enqueueUpdates(store: Store, updates: TelegramUpdate[], settings: TelegramSettings): boolean {
  const results = updates.map(update => ({ update, jobs: telegramJobs(update, settings) }));
  results.filter(result => !result.jobs.length).forEach(result => log('info', describeIgnored(result.update)));
  return results.flatMap(result => result.jobs).map(job => store.enqueue(job)).some(Boolean);
}

export const nextOffset = (updates: TelegramUpdate[], offset: number) =>
  updates.reduce((next, update) => Math.max(next, update.update_id + 1), offset);

type PollOptions = { store: Store; settings: TelegramSettings; wake: () => void; signal: AbortSignal; request?: typeof fetch };

// Telegram re-delivers updates until a later getUpdates passes a higher offset,
// so the offset only advances after the jobs are stored: a crash loses nothing.
export async function pollTelegram({ store, settings, wake, signal, request = fetch }: PollOptions): Promise<void> {
  let offset = 0;
  while (!signal.aborted) {
    try {
      const updates = await telegramCall<TelegramUpdate[]>(settings.token, 'getUpdates',
        { offset, timeout: 25, allowed_updates: ['message'] }, AbortSignal.any([signal, AbortSignal.timeout(35_000)]), request);
      if (enqueueUpdates(store, updates, settings)) wake();
      offset = nextOffset(updates, offset);
    } catch (error) {
      if (signal.aborted) return;
      if (error instanceof TelegramRejected && error.code === 401) throw error; // Bad token: stop loudly.
      log('error', `${(error as Error).message}; retrying in 5s.`);
      await sleep(5000, undefined, { signal }).catch(() => {});
    }
  }
}

type Outbox = { payload_hash: string; state: 'sending' | 'sent' | 'rejected' };

// Telegram has no send idempotency key. Record each part before sending it:
// "sent" parts are skipped on retry; a rejection (nothing was sent) may be
// retried; an unknown outcome is held for review instead of risking a duplicate.
async function sendPartOnce(store: Store, token: string, key: string, body: object, request: typeof fetch): Promise<void> {
  const hash = createHash('sha256').update(JSON.stringify(body)).digest('hex');
  const prior = store.db.prepare('SELECT payload_hash,state FROM telegram_outbox WHERE key=?').get(key) as Outbox | undefined;
  if (prior?.state === 'sent' && prior.payload_hash === hash) return;
  if (prior && prior.state !== 'rejected') throw new DeliveryReviewRequired('Telegram send requires review');
  store.db.prepare("INSERT INTO telegram_outbox(key,payload_hash,state) VALUES(?,?,'sending') ON CONFLICT(key) DO UPDATE SET payload_hash=excluded.payload_hash,state='sending'").run(key, hash);
  try {
    await telegramCall(token, 'sendMessage', body, AbortSignal.timeout(30_000), request);
  } catch (error) {
    if (!(error instanceof TelegramRejected)) throw new DeliveryReviewRequired('Telegram acceptance uncertain');
    store.db.prepare("UPDATE telegram_outbox SET state='rejected' WHERE key=?").run(key);
    throw error;
  }
  store.db.prepare("UPDATE telegram_outbox SET state='sent' WHERE key=?").run(key);
}

// Same message layout as WhatsApp: the summary (split at 4096 chars), then one
// message per source link with its native preview enabled.
export async function sendTelegramReply(store: Store, settings: TelegramSettings, chat: string, text: string,
  key: string, originalRequest = '', request: typeof fetch = fetch): Promise<void> {
  if (chat !== telegramChat(settings.ownerId)) throw new DeliveryReviewRequired('Telegram destination is not the configured owner');
  const parts = whatsappTextParts(text, originalRequest);
  if (!parts.length) throw new DeliveryReviewRequired('Empty Telegram reply');
  for (const [index, part] of parts.entries()) {
    await sendPartOnce(store, settings.token, `${key}:${index}`,
      { chat_id: chatId(chat), text: part.body, link_preview_options: { is_disabled: !part.preview_url } }, request);
  }
}

// Telegram shows "typing…" for about 5 seconds per call, so refresh every 4s.
// There is no explicit stop; sending the reply clears it.
export async function startTelegramTyping(settings: TelegramSettings, chat: string, request: typeof fetch = fetch): Promise<() => Promise<void>> {
  const refresh = () => telegramCall(settings.token, 'sendChatAction', { chat_id: chatId(chat), action: 'typing' },
    AbortSignal.timeout(3000), request).then(() => {}, () => log('error', 'Typing indicator unavailable; continuing.'));
  await refresh();
  const timer = setInterval(refresh, 4000);
  timer.unref();
  return async () => clearInterval(timer);
}
