// Telegram channel for the complete agent: pnpm run solution:telegram
// Polls Telegram for messages (no webhook server, no tunnel) and replies through
// the same durable job queue as the Linq/WhatsApp server.
import { answer } from './agent.ts';
import { assertReady, config } from './config.ts';
import { isVoiceRequest } from './response.ts';
import { Store } from './store.ts';
import { Worker } from './worker.ts';
import { log, pollTelegram, sendTelegramReply, startTelegramTyping, telegramCall, type TelegramSettings, type TelegramUser } from './telegram.ts';

function loadSettings(): TelegramSettings {
  if (config.messagingChannel !== 'telegram') throw new Error('Set MESSAGING_CHANNEL=telegram in .env to run the Telegram bot.');
  assertReady(true);
  return { token: config.telegramToken, ownerId: config.telegramOwnerId, scope: config.owner };
}

function createWorker(store: Store, settings: TelegramSettings): Worker {
  const generate = (scope: string, text: string) => isVoiceRequest(text)
    ? Promise.resolve('Voice replies are only available in the Linq demo. Ask me in text and I’ll answer here.')
    : answer(store, scope, text);
  return new Worker(store, generate, (chat, text, key, request) => sendTelegramReply(store, settings, chat, text, key, request),
    undefined, 'telegram', chat => startTelegramTyping(settings, chat));
}

// First Ctrl-C stops polling and lets the current reply finish (its state is
// durable either way); a second Ctrl-C exits immediately.
function onShutdown(controller: AbortController): void {
  const stop = () => {
    if (controller.signal.aborted) process.exit(130);
    log('info', 'Stopping: finishing any reply in progress. Press Ctrl-C again to quit now.');
    controller.abort();
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

async function waitUntilIdle(worker: Worker): Promise<void> {
  while (worker.busy) await new Promise(resolve => setTimeout(resolve, 100));
}

async function run(settings: TelegramSettings): Promise<void> {
  const bot = await telegramCall<TelegramUser>(settings.token, 'getMe', {}, AbortSignal.timeout(15_000));
  const store = new Store(config.dataDir);
  const worker = createWorker(store, settings);
  const wake = () => { void worker.tick().catch(error => log('error', `Worker storage error: ${(error as Error).message}`)); };
  const controller = new AbortController();
  onShutdown(controller);
  const timer = setInterval(wake, 1000);
  log('info', `Bot @${bot.username} ready; answering Telegram user ${settings.ownerId}. Ctrl-C to stop.`);
  wake();
  try { await pollTelegram({ store, settings, wake, signal: controller.signal }); }
  finally { clearInterval(timer); await waitUntilIdle(worker); store.close(); }
}

try {
  await run(loadSettings());
} catch (error) {
  log('error', (error as Error).message);
  process.exitCode = 1;
}
