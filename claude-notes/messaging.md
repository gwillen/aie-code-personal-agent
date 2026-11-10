# Messaging channels

- Channels: `linq` (default, webhook via ngrok, `src/server.ts`), `whatsapp` (webhook via ngrok, `src/server.ts`), `telegram` (long polling, `src/telegram-bot.ts`, `pnpm run solution:telegram`). Telegram was added in this fork on 2026-11-10 because the workshop's Linq demo accounts weren't working. It isn't in upstream.
- Jobs are filed by chat-ID prefix: `whatsapp:…` and `telegram:…`, while Linq's are unprefixed. `channelFilter()` in `src/store.ts` is the only place that maps a channel to its jobs. A new prefixed channel must be added to `prefixedChannels` there, or Linq's server would pick up its jobs.
- Telegram design:
  - Polling advances the offset only after the jobs are saved. Telegram re-delivers unconfirmed updates, and `store.enqueue` dedups by job ID.
  - `telegram_outbox` mirrors `whatsapp_outbox`, with one difference: a `TelegramRejected` result (Telegram answered `ok:false`) means nothing was sent, so it's retried. Only an unknown outcome (`TelegramUnreachable`) is held for review.
  - The token is part of every Bot API URL, so `telegramCall` builds its own error messages and never includes the URL. A test checks this.
  - Memory/history scope is `OWNER_PHONE_NUMBER` (same as terminal chat), not the Telegram user ID.
- `whatsappTextParts()` (in src/whatsapp.ts) is reused by Telegram for splitting the summary and links. The logic doesn't depend on the channel; only the name does.
- Possible refactor, not done: the WhatsApp and Telegram outbox logic could share one generic "send once" helper and one table.
