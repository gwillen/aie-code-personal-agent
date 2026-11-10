// Find your numeric Telegram user ID for TELEGRAM_OWNER_ID: message your bot
// in Telegram, then run pnpm run telegram:whoami. Read-only: it peeks at
// pending updates without marking them as received.
import { config } from './config.ts';
import { telegramCall, type TelegramUpdate, type TelegramUser } from './telegram.ts';

function senders(updates: TelegramUpdate[]): TelegramUser[] {
  const byId = new Map(updates.flatMap(update => update.message?.chat?.type === 'private' && update.message.from ? [update.message.from] : [])
    .map(user => [user.id, user] as const));
  return [...byId.values()];
}

const describe = (user: TelegramUser) => `TELEGRAM_OWNER_ID=${user.id}   (${[user.first_name, user.username && `@${user.username}`].filter(Boolean).join(' ')})`;

try {
  if (!config.telegramToken.trim()) throw new Error('Set TELEGRAM_BOT_TOKEN in .env first.');
  const bot = await telegramCall<TelegramUser>(config.telegramToken, 'getMe', {}, AbortSignal.timeout(15_000));
  const updates = await telegramCall<TelegramUpdate[]>(config.telegramToken, 'getUpdates', { timeout: 0, allowed_updates: ['message'] }, AbortSignal.timeout(15_000));
  const found = senders(updates);
  console.log(found.length
    ? `People who have messaged @${bot.username} recently:\n${found.map(describe).join('\n')}`
    : `No recent private messages to @${bot.username}. Send it any message in Telegram, then run this again.`);
} catch (error) {
  console.error((error as Error).message);
  process.exitCode = 1;
}
