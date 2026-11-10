# Use Telegram for the complete demo

An alternative to Linq for texting your agent. The bot **polls** Telegram for new messages, so it needs no public webhook, no ngrok tunnel, and no business account: your laptop only makes outbound connections. The same agent, Exa search, Kernel browser, and Mem0 profile work as on the other channels. It runs the complete solution in `src/`, not the starter, because starter TODO 5 is Linq-specific.

Supported: direct text messages from you (the owner), text replies, and native link previews for source links (one by default, up to three when you ask for more). Telegram shows "typing…" while the agent is working. Voice replies and emoji reactions remain Linq features. Messages from anyone else, from groups, and anything that isn't text are ignored and logged.

## 1. Create a bot

1. In Telegram, open a chat with [@BotFather](https://t.me/BotFather) and send `/newbot`. Choose a display name and a username ending in `bot`.
2. BotFather replies with a token like `123456789:AA...`. Treat it like a password: anyone holding it can act as your bot.
3. Optional: send BotFather `/setjoingroups` and disable it, so nobody can add your bot to a group.

## 2. Configure `.env`

```dotenv
WORKSHOP_MILESTONE=5
MESSAGING_CHANNEL=telegram
TELEGRAM_BOT_TOKEN=<token from BotFather>
OWNER_PHONE_NUMBER=<your phone number in E.164 format, e.g. +12025550100>
```

`OWNER_PHONE_NUMBER` isn't sent to Telegram. It is the memory scope, so use the same value as in terminal chat to share saved preferences between the two.

## 3. Find your Telegram user ID

Telegram identifies you by a numeric user ID, not your phone number. Open your bot (`https://t.me/<bot username>`), press **Start** or send any message, then run:

```sh
pnpm run telegram:whoami
```

It lists who has recently messaged the bot, as `TELEGRAM_OWNER_ID=<number>` lines. Copy yours into `.env`. This only peeks at pending messages; it doesn't mark them as read.

## 4. Run it

```sh
pnpm run doctor
pnpm run solution:telegram
```

The bot logs `Bot @<username> ready`. Then message it:

```text
/help
Remember I live in San Francisco and like sushi.
Find a sushi dinner option in San Francisco.
What do you remember about me?
```

Messages you sent while the bot was stopped are picked up when it starts (Telegram keeps them for 24 hours). Press Ctrl-C to stop: the bot stops polling and finishes any reply in progress. Press Ctrl-C again to quit immediately. Run one bot process per token and data directory: Telegram allows only one poller per bot.

## Delivery behavior

Incoming messages are deduplicated by message ID, and the poller only confirms a batch to Telegram after its jobs are saved, so a crash or restart doesn't lose or repeat messages. Replies go through the same durable queue as the other channels.

Telegram has no send idempotency key, so each reply part is recorded in the local `telegram_outbox` table before it's sent:

- If Telegram rejects a part (for example rate limiting), nothing was sent, so the worker retries it (up to three attempts per job).
- If the outcome is unknown (network failure or timeout), the job is put in `needs_review` and not resent automatically, to avoid duplicate messages. Check your phone, then inspect `jobs` and `telegram_outbox` in `.data/agent.sqlite`. Send a new message to get a fresh reply.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| `getMe rejected (401…)` | `TELEGRAM_BOT_TOKEN` is wrong or was revoked |
| `getUpdates rejected (409…)` | Another process is polling with the same token (a second bot, or `telegram:whoami` while the bot runs), or a webhook was set on the bot |
| `Ignored update … from user N` | Your messages come from user N, but `TELEGRAM_OWNER_ID` is different. Also check you're messaging the bot directly, not in a group |
| No reply, no log line | The bot is running and you're messaging the right bot (`@username` in the ready line) |
| Memories differ from terminal chat | `OWNER_PHONE_NUMBER` matches the value used in terminal chat |

## Privacy

Bot chats are not end-to-end encrypted: Telegram's servers see your messages and the agent's replies. Anyone can find and message a bot by its username. This bot answers only `TELEGRAM_OWNER_ID` and doesn't reply to anyone else. After the workshop, stop the bot. To invalidate the token, send BotFather `/revoke`; to remove the bot, send `/deletebot`.
