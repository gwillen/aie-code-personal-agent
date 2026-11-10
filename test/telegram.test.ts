import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { config, assertReady } from '../src/config.ts';
import { Store } from '../src/store.ts';
import { Worker, DeliveryReviewRequired } from '../src/worker.ts';
import { enqueueUpdates, nextOffset, pollTelegram, sendTelegramReply, telegramCall, telegramChat, telegramJobs,
  TelegramRejected, type TelegramUpdate } from '../src/telegram.ts';

const ownerId = '424242', token = '123456:fake-token-fake-token-fake-token-xx';
const settings = { token, ownerId, scope: '+12025550100' };
const ownerChat = telegramChat(ownerId);

function update(update_id: number, overrides: Partial<NonNullable<TelegramUpdate['message']>> = {}): TelegramUpdate {
  return { update_id, message: { message_id: update_id * 10, from: { id: Number(ownerId) },
    chat: { id: Number(ownerId), type: 'private' }, text: 'Find dinner.', ...overrides } };
}
function setup(t: { after: (fn: () => void) => void }) {
  const directory = mkdtempSync(join(tmpdir(), 'aie-telegram-'));
  const store = new Store(directory);
  t.after(() => { store.close(); rmSync(directory, { recursive: true, force: true }); });
  return store;
}
const ok = (result: unknown) => Response.json({ ok: true, result });
const rejected = (code: number) => Response.json({ ok: false, error_code: code, description: 'Bad Request: test' });
type Call = { method: string; body: Record<string, any> };
function fakeTelegram(respond: (call: Call) => Response | Promise<Response>, calls: Call[] = []): typeof fetch {
  return (async (url: string | URL | Request, init?: RequestInit) => {
    const call = { method: String(url).split('/').pop()!, body: JSON.parse(String(init?.body)) };
    calls.push(call);
    return respond(call);
  }) as typeof fetch;
}

test('only the owner’s private text messages become jobs in the shared owner scope', () => {
  assert.deepEqual(telegramJobs(update(1), settings), [{ id: `telegram:${ownerId}:10`, event_id: `telegram:${ownerId}:10`,
    chat: ownerChat, sender: settings.scope, text: 'Find dinner.' }]);
  assert.deepEqual(telegramJobs(update(2, { from: { id: 999 }, chat: { id: 999, type: 'private' } }), settings), []);
  assert.deepEqual(telegramJobs(update(3, { chat: { id: -100, type: 'group' } }), settings), []);
  assert.deepEqual(telegramJobs(update(4, { from: { id: Number(ownerId), is_bot: true } }), settings), []);
  assert.deepEqual(telegramJobs(update(5, { text: undefined }), settings), []);
  assert.deepEqual(telegramJobs(update(6, { text: '   ' }), settings), []);
  assert.deepEqual(telegramJobs({ update_id: 7 }, settings), []);
  assert.equal(telegramJobs(update(8, { text: 'x'.repeat(8001) }), settings)[0].text, '/too-long');
});

test('redelivered updates are deduplicated and the offset advances past the batch', t => {
  const store = setup(t);
  const batch = [update(5), update(6, { from: { id: 1 }, chat: { id: 1, type: 'private' } }), update(7)];
  assert.equal(enqueueUpdates(store, batch, settings), true);
  assert.equal(enqueueUpdates(store, batch, settings), false);
  assert.equal(store.stats()[0].count, 2);
  assert.equal(nextOffset(batch, 0), 8);
  assert.equal(nextOffset([], 8), 8);
});

test('polling queues owner messages, confirms the offset, and stops promptly on abort', async t => {
  const store = setup(t);
  const controller = new AbortController();
  const calls: Call[] = [];
  let woken = 0;
  const request = fakeTelegram(call => {
    if (calls.length === 1) return ok([update(41), update(42)]);
    // Second poll: confirm the offset, then simulate Ctrl-C during the long poll.
    controller.abort();
    return ok([]);
  }, calls);
  await pollTelegram({ store, settings, wake: () => { woken++; }, signal: controller.signal, request });
  assert.deepEqual(calls.map(call => call.body.offset), [0, 43]);
  assert.deepEqual(calls[0].body.allowed_updates, ['message']);
  assert.equal(woken, 1);
  assert.equal(store.next(Date.now(), 'telegram')?.id, `telegram:${ownerId}:410`);
});

test('polling stops loudly on a rejected token instead of retrying forever', async t => {
  const store = setup(t);
  const request = fakeTelegram(() => rejected(401));
  await assert.rejects(pollTelegram({ store, settings, wake: () => {}, signal: new AbortController().signal, request }), TelegramRejected);
});

test('API errors never include the bot token', async () => {
  const unreachable = (() => { throw new TypeError(`fetch failed for https://api.telegram.org/bot${token}/getMe`); }) as typeof fetch;
  for (const request of [unreachable, fakeTelegram(() => rejected(400)), fakeTelegram(() => new Response('<html>', { status: 502 }))]) {
    await assert.rejects(telegramCall(token, 'getMe', {}, AbortSignal.timeout(1000), request), (error: Error) => !error.message.includes(token));
  }
});

test('replies send a summary, then each source link with its preview enabled', async t => {
  const store = setup(t);
  const calls: Call[] = [];
  await sendTelegramReply(store, settings, ownerChat, 'Dinner. https://example.com/menu', 'key-1', 'Find dinner.', fakeTelegram(() => ok({ message_id: 1 }), calls));
  assert.deepEqual(calls.map(call => [call.body.chat_id, call.body.text, call.body.link_preview_options]), [
    [ownerId, 'Dinner.', { is_disabled: true }], [ownerId, 'https://example.com/menu', { is_disabled: false }]]);
  // A retry after full success sends nothing again.
  await sendTelegramReply(store, settings, ownerChat, 'Dinner. https://example.com/menu', 'key-1', 'Find dinner.', fakeTelegram(() => assert.fail('resent')));
});

test('a rejected part is retried; an uncertain part is held for review, never resent', async t => {
  const store = setup(t);
  const sent: string[] = [];
  const text = 'Dinner. https://example.com/menu';
  const rejectLink = fakeTelegram(call => call.body.text.startsWith('https://') ? rejected(429) : (sent.push(call.body.text), ok({})));
  await assert.rejects(sendTelegramReply(store, settings, ownerChat, text, 'key-2', '', rejectLink), TelegramRejected);
  await sendTelegramReply(store, settings, ownerChat, text, 'key-2', '', fakeTelegram(call => (sent.push(call.body.text), ok({}))));
  assert.deepEqual(sent, ['Dinner.', 'https://example.com/menu']);

  const timeout = (() => Promise.reject(new DOMException('timed out', 'TimeoutError'))) as typeof fetch;
  await assert.rejects(sendTelegramReply(store, settings, ownerChat, 'Hello.', 'key-3', '', timeout), DeliveryReviewRequired);
  await assert.rejects(sendTelegramReply(store, settings, ownerChat, 'Hello.', 'key-3', '', fakeTelegram(() => assert.fail('resent'))), DeliveryReviewRequired);
  await assert.rejects(sendTelegramReply(store, settings, telegramChat('999'), 'Hello.', 'key-4', '', fakeTelegram(() => assert.fail('sent'))), DeliveryReviewRequired);
});

test('each server only takes its own channel’s jobs', async t => {
  const store = setup(t);
  store.enqueue(telegramJobs(update(1), settings)[0]);
  store.enqueue({ id: 'linq-1', event_id: 'linq-1', chat: 'linq-chat', sender: settings.scope, text: 'Hello' });
  store.enqueue({ id: 'whatsapp:1:1', event_id: 'whatsapp:1:1', chat: 'whatsapp:1:1', sender: settings.scope, text: 'Hello' });
  const sent: string[] = [];
  for (const channel of ['linq', 'telegram', 'whatsapp'] as const) {
    await new Worker(store, async () => 'Hello', async chat => { sent.push(`${channel}:${chat}`); }, undefined, channel).tick();
  }
  assert.deepEqual(sent, ['linq:linq-chat', `telegram:${ownerChat}`, 'whatsapp:whatsapp:1:1']);
});

test('telegram config needs a bot token and numeric owner ID, not Linq credentials', () => {
  const previous = { ...config };
  try {
    Object.assign(config, { milestone: 5, modelKey: 'fake', exaKey: 'fake', kernelKey: 'fake', owner: settings.scope,
      messagingChannel: 'telegram', telegramToken: token, telegramOwnerId: ownerId, linqKey: '', line: '', webhookSecret: '' });
    assert.doesNotThrow(() => assertReady(true));
    config.telegramOwnerId = '@me'; assert.throws(() => assertReady(true), /TELEGRAM_OWNER_ID/);
    config.telegramOwnerId = ownerId; config.telegramToken = 'nope'; assert.throws(() => assertReady(true), /TELEGRAM_BOT_TOKEN/);
  } finally {
    const { browserEnabled: _getter, ...values } = previous;
    Object.assign(config, values);
  }
});
