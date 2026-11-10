# Run the personal agent workshop

Use a short overview followed by guided building. For a 60-minute session, allocate **12 minutes to the overview, 40 to the workshop, and 8 to Q&A**. For 90 minutes, keep the overview at 12, extend the workshop to 60, and reserve 18 for Q&A. Both formats teach model → Exa → Kernel → Mem0 → Linq. The longer version gives attendees more time to implement and demonstrate each integration.

## Before the event

Send the [participant guide](WORKSHOP.md) and [Linq prework](LINQ.md) several days ahead. Ask attendees to install Node 26.12.1+ and pnpm 11+ before class, preferably via [nvm](https://github.com/nvm-sh/nvm#installing-and-updating) on macOS, Linux, or Windows WSL, and arrange funded model and Exa keys. Have them verify `node --version` and `pnpm --version`. Show the clone slide immediately after the cover and let attendees install dependencies during the overview. Have them install an MCP-capable coding assistant before class. Arrange a provisioned Linq line for each independently running laptop. Confirm account access, line availability, messaging support, and tunnel access before promising that everyone will leave with phone messaging.

Rehearse on the event network using the same model and embedding settings. `pnpm run doctor` makes no network calls and does not verify API-key validity; verify actual model replies, embeddings, browser reads, and phone delivery before class. Test a real inbound message, source retrieval, memory save, and memory recall after restarting. Use a separate workshop data directory and your own demonstration profile. Avoid displaying `.env`, tokens, account pages, personal messages, or unrelated memories on the projector.

Have attendees arrange Kernel access and set `KERNEL_API_KEY` before milestone 3. A blocked restaurant website should not consume the class; use another public source.

## Presenter view

Run `pnpm run slides`, then open [Presenter view](http://127.0.0.1:3402/presenter), or press P in the deck. Click **Open audience window** and share only that window. The Shanghai-style presenter view keeps current and next previews, synchronized navigation, speaker notes, and a timer on your own screen. Edit script saves notes in this browser; Export my notes downloads a backup. Use **Advance example conversation** to step through the authored demo.

## The twelve minute overview

Run `pnpm run slides`. Use [speaker notes](../slides/SPEAKER-NOTES.md) or press N in the deck. The opening section occupies slides 1–13, including the early clone slide. The step-by-step API integration walkthrough follows in the same deck at **http://127.0.0.1:3402/#slide-14**, opened after the overview ends. Clone at the beginning; begin SDK wiring after the overview. Its default worked example uses a manually checked official menu source; switch to Live agent or Messages for a real demonstration. The example is authored and explicitly labeled, rather than a captured model response:

| Time | Content |
| --- | --- |
| 0:00–0:20 | Exa in Personal Agents |
| 0:20–1:10 | What is Exa? Search and data partnerships |
| 1:10–2:10 | Search API |
| 2:10–2:55 | Contents API |
| 2:55–3:55 | Agent API |
| 3:55–4:40 | Monitors API |
| 4:40–5:50 | Why highlights: less text, useful evidence |
| 5:50–7:00 | Data partners: Search and Agent access paths |
| 7:00–9:00 | A table for two |
| 9:00–10:10 | From message to answer |
| 10:10–11:00 | What runs locally |
| 11:00–12:00 | Start the hands-on workshop |

Use the US dinner scenario throughout: San Francisco, sushi, a $150 budget before tax and tip, and a quieter setting for a friend. These are sample preferences rather than captured facts about the presenter. The Robin pricing excerpt was checked on November 6, 2026; recheck before presenting on a later date. The phone conversation is authored. The highlights slide adapts the Shanghai page-to-passages animation, then shows a real Search response with one official San Francisco result selected and its excerpt shortened. Let the seven-second sequence finish, or use See result. Replay restarts it. The surrounding page text is fictional and the word counts are illustrative, not a token or latency benchmark. The opening “What is Exa?” slide reuses the latest Shanghai partner grid and use-case layout. Introduce Exa as search for AI agents, combining an independent web index with data partnerships. On the later access-path slide, distinguish Search-resolved sources from capabilities attached to Exa Agent runs; use [the Exa reference](EXA.md) for source links and exact scope. Do not reuse Shanghai recordings or a dated forecast as current US results.

## The forty minute workshop

Start a separate workshop timer after the overview. Give each milestone a visible checkpoint, then continue when most attendees have it working. Participants implement the five TODOs in `starter/integrations.ts`, using the shared adapters and bounded loop. Keep your complete version running with `solution:phone`; it does not depend on their unfinished exercises.

| Workshop time | Milestone | Demonstrable result |
| --- | --- | --- |
| 0–3 | Connect and use Exa MCP | A real MCP tool call returns official API documentation |
| 3–7 | Model | A real assistant response |
| 7–13 | Exa | A checked source returned through a tool call |
| 13–19 | Kernel | Rendered text from a real browser session |
| 19–26 | Mem0 | Owner preferences survive restart |
| 26–35 | Linq | A genuine text-only phone round trip |
| 35–40 | Feature: source cards | Repeat the same search and compare before/after |

Show the exact file to inspect at each step. Keep changes small: message style in the system prompt, search result count, preference scope, and the webhook-to-worker path. Leave time for participants to explain what changed in their answer.

If a participant is blocked on credentials, pair them with someone configured rather than distributing shared secrets. If Linq provisioning is unavailable, finish the agent locally and clearly mark phone integration as pending. A CLI demonstration does not satisfy the phone round-trip checkpoint.

## Extend the workshop to sixty minutes

Use the same five milestones with more implementation time, then let attendees choose optional Jev emoji reactions and typing bubbles (10–15 minutes) or OpenRouter voice replies (15–20 minutes). Both have starter functions in starter/extras.ts and prompts in the deck. The instructor demo supports Jev reactions with local fallback, typing after reactions, and both `/voice` and natural-language voice requests; attendee functions remain unfinished. Reserve the final five minutes for paired demonstrations. Each demonstration should show one preference, one current source, and one changed constraint.

Good adaptations include weekend hikes, local developer meetups, and personal research. Keep calendar access, bookings, payments, and proactive alerts as discussion topics; the repository does not implement them.

## Q&A

Start questions at minute 52 for a one-hour slot, or minute 72 for a 90-minute slot. Seed discussion with:

- What belongs in persistent memory rather than chat history?
- When are search highlights enough, and when is browsing useful?
- What changes when the laptop sleeps or the tunnel URL rotates?
- How would you move this to an always-on host while retaining owner isolation?
- What would a proactive version need: scheduling, fresh evidence, notification policy, and explicit controls?

## Standalone repository release

This directory is the standalone repository root. It includes source, slides, participant and facilitator docs, tests, MIT license, and the Node lockfile. The parent presentation is not a dependency.

Copy the directory to a new empty checkout, including its hidden configuration templates. Run `pnpm install --frozen-lockfile`, `pnpm run typecheck`, and `pnpm test` there. Inspect the staged files before publishing: no `.env`, runtime `.data`, personal screenshots, recordings, browser profiles, or dependency directories. The curated teaching images in `slides/assets` are part of the deck. Share the public repository URL, https://github.com/JakubHojsan/aie-code-personal-agent, before class. Verify the HTTPS clone command while signed out of GitHub; participants should not need an account or repository invitation.

After class, have attendees stop the server and tunnel and disable their workshop webhook subscriptions. To keep the agent available later, they need an awake laptop with a running tunnel or an always-on deployment.
