# Memory (Mem0) behavior

## Natural-language saves are unreliable (found 2026-11-10)

- **Symptom:** "Remember that I'm vegetarian and I live in Oakland" sometimes saves nothing. `remember()` returns no records, and the tool result says `saved: false`. `/remember …` works reliably.
- **Cause (confirmed by tracing):** the agent passes Mem0 a `fact` string written by the model for the `remember_preference` tool call, not the owner's message. Qwen (qwen/qwen3.8-27b) usually writes it in the third person ("Owner is vegetarian.", "The owner lives in Oakland."). The worker's Mem0 `customInstructions` (src/memory-worker.ts) say to extract only facts stated by the user and to skip text about other people. Mem0's extractor sometimes treats "the owner" as another person and returns `memory: []`.
- **Evidence:** 3 traced agent runs (scratch script wrapping the memory adapter) made 6 `remember()` calls. Third-person: 2 of 4 saved nothing ("The owner is vegetarian and lives in Oakland.", "Owner is vegetarian and lives in Oakland."). First-person ("I'm vegetarian.", "I live in Oakland."): 2 of 2 saved. Calling the worker directly: "The owner lives in Oakland" → [], while "Owner is vegetarian", "User is vegetarian and lives in Oakland" and "Vegetarian; lives in Oakland" were all saved. Small sample. Treat this as a consistent pattern, not a measured rate.
- **Related:** in one run nothing was saved, but the model still replied "I've saved that…", despite `saved: false` in the tool result and a system prompt forbidding that claim.
- **Debugging technique:** the worker hides all console output and errors. To see provider traffic without editing it, run a wrapper that installs a logging `globalThis.fetch` and then `await import('src/memory-worker.ts')`. The worker captures the existing fetch as its "native" one, so the logger ends up underneath. Feed the wrapper the same stdin JSON that `src/memory.ts` builds.

## Testing notes

- Run tests with `DATA_DIR` pointed somewhere disposable so they don't touch the user's `.data/`.
- When checking recall after a restart, run `/reset` first. Otherwise the agent can answer from the conversation history in `agent.sqlite` instead of from Mem0, which looks like a passing recall test even when nothing was saved.
