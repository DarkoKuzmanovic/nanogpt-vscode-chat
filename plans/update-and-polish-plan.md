# Plan: Update & Polish NanoGPT VS Code Chat Provider

**Created:** 2026-01-31
**Status:** Ready for Atlas Execution

## Summary

This plan targets a small, safe release focused on correctness, UX polish, and documentation hygiene for the NanoGPT Copilot Chat model provider. The main goals are to remove user-facing confusion (API key handling + settings), improve reliability (stream parsing, timeouts, error messages), and align the extension’s behavior with its existing configuration options. Changes are scoped to be shippable as a patch/minor release (recommended: `0.1.2`).

## Context & Analysis

**Relevant Files:**

- `src/provider.ts`: Core provider implementation; model discovery, caching, message conversion, streaming SSE parsing.
- `src/extension.ts`: Command UX; manages API key, model selection, refreshing models.
- `package.json`: Contribution points (provider, commands, configuration), metadata (repo URL), version.
- `README.md`: User-facing setup/config docs; currently claims API key is a setting.
- `CHANGELOG.md`: Needs an entry for the polish release.
- `LICENSE`: Contains an unusual year line that should be normalized.

**Key Functions/Classes:**

- `NanoGPTChatModelProvider.fetchAvailableModels()` in `src/provider.ts`: Fetch/caching + subscription tagging + sorting.
- `NanoGPTChatModelProvider.provideLanguageModelChatInformation()` in `src/provider.ts`: Determines what models appear in picker.
- `NanoGPTChatModelProvider.provideLanguageModelChatResponse()` in `src/provider.ts`: Streaming chat + tool calls + cancellation.
- `activate()` in `src/extension.ts`: Provider registration + commands.

**Dependencies:**

- VS Code LM API: `vscode.lm.registerLanguageModelChatProvider`, `LanguageModelChatProvider` methods.
- Node `fetch` / Web streams: used for SSE streaming.

**Notable Issues/Polish Opportunities Identified:**

- **API key confusion:** `package.json` exposes `nanogpt.apiKey` as a setting, but the code reads the key from Secret Storage (`context.secrets.get("nanogpt.apiKey")`). Users can set the setting and still “have no API key”.
- **Unused settings:** `nanogpt.autoFetchModels` and `nanogpt.showSubscriptionModelsFirst` exist but aren’t respected in code paths that matter.
- **Command robustness:** `nanogpt.selectModels` uses `vscode.window.withProgress(...)` but does not `await` it, so errors can bypass the surrounding `try/catch`.
- **Message conversion gaps:** Roles beyond `User`/`Assistant` (e.g., `System`, `Tool`) and tool call input parts are not converted; this can break multi-step tool calling sessions.
- **Model capability defaults:** `toolCalling` is currently effectively always `true` due to `model.capabilities?.tools || true`.
- **Packaging/documentation hygiene:** repository URLs still include placeholders; README claims settings-based key storage; LICENSE year line is odd.

## Implementation Phases

### Phase 1: Baseline Release Hygiene (metadata + docs + versioning)

**Objective:** Make the extension’s manifest/docs accurate and ready for a clean patch release.

**Files to Modify/Create:**

- `package.json`: Fix `repository.url`, bump version to `0.1.2` (recommended).
- `README.md`: Align docs with actual behavior (Secret Storage + commands).
- `CHANGELOG.md`: Add `0.1.2` entry dated `2026-01-31`.
- `LICENSE`: Normalize copyright year line.

**Tests to Write:**

- Manual: `npm run compile`.

**Steps:**

1. Update `package.json.repository.url` to `https://github.com/DarkoKuzmanovic/nanogpt-vscode-chat` and update README clone instructions similarly.
2. Bump `package.json.version` and add `CHANGELOG.md` section:
   - `### Fixed`: API key/settings mismatch, model sorting toggle, selectModels awaiting progress (as implemented in later phases).
   - `### Changed`: documentation clarifications.
3. Update README:
   - Replace “Extension Settings” claim that `nanogpt.apiKey` is a secure setting.
   - Document: key is stored in Secret Storage and configured via “NanoGPT: Set API Key”.
4. Normalize `LICENSE` year line to a conventional range (e.g., `2024-2026`).

**Acceptance Criteria:**

- [ ] Marketplace metadata and README links are correct.
- [ ] README instructions match actual extension behavior.
- [ ] `npm run compile` succeeds.

---

### Phase 2: API Key Handling (fix root-cause confusion + migration)

**Objective:** Make API key handling consistent, user-proof, and backward-compatible.

**Files to Modify/Create:**

- `src/extension.ts`: Command logic for setting/removing key; migrate from settings.
- `src/provider.ts`: Centralize API key retrieval logic.
- `package.json`: Decide fate of `nanogpt.apiKey` config property.

**Implementation Approach (Recommended):**

- Treat Secret Storage as the source of truth.
- Add a migration path: if `nanogpt.apiKey` setting is present but Secret Storage is empty, migrate it to secrets once.
- Optionally remove `nanogpt.apiKey` from configuration schema (or keep but clearly warn); recommendation depends on how strongly you want to discourage insecure storage.

**Tests to Write:**

- Manual: verify migration + prompts in Extension Development Host.

**Steps:**

1. Add a helper in the provider (or a shared util) like `getApiKey()`:
   - Check Secret Storage first.
   - If missing, check `vscode.workspace.getConfiguration("nanogpt").get("apiKey")`.
   - If found in settings, store to secrets and clear the setting (with confirmation if you want to be conservative).
2. Update all call sites to use the helper (`fetchAvailableModels`, `provideLanguageModelChatInformation`, `provideLanguageModelChatResponse`, commands).
3. Add a new command: “NanoGPT: Clear API Key” (optional but high-value polish), and expose it in the manage menu.
4. Update `package.json` configuration:
   - **Option A (safer UX):** keep `nanogpt.apiKey` but update description to explicitly say it’s deprecated/insecure and will be migrated to Secret Storage.
   - **Option B (cleaner):** remove `nanogpt.apiKey` from config schema, rely purely on commands + secret storage.

**Acceptance Criteria:**

- [ ] Users who set `nanogpt.apiKey` in Settings start working without extra steps.
- [ ] API key is ultimately stored in Secret Storage.
- [ ] No UI prompts appear when `options.silent` is true.

---

### Phase 3: Respect Existing Settings + Improve Model Fetching/Caching

**Objective:** Make `autoFetchModels` and `showSubscriptionModelsFirst` actually work; reduce redundant network calls.

**Files to Modify/Create:**

- `src/provider.ts`
- `src/extension.ts`

**Tests to Write:**

- Manual: verify model ordering toggle; verify auto-fetch behavior.

**Steps:**

1. Update `fetchAvailableModels()` sorting logic to respect `nanogpt.showSubscriptionModelsFirst`:
   - If true: subscription first, then name.
   - If false: pure alphabetical (or preserve API order).
2. Add in-flight de-duplication for model fetching:
   - Store a private `modelsFetchPromise?: Promise<NanoGPTModel[]>` to avoid concurrent duplicate calls.
3. Respect `nanogpt.autoFetchModels`:
   - In `activate()`, if enabled, trigger a background `provider.fetchAvailableModels()` (no prompts; no blocking activation).
4. Make refresh command more informative:
   - Clear cache + optionally immediately fetch and show “Fetched N models”.

**Acceptance Criteria:**

- [ ] Toggling `showSubscriptionModelsFirst` changes ordering.
- [ ] Multiple callers don’t cause multiple simultaneous fetches.
- [ ] Startup model prefetch occurs only when configured.

---

### Phase 4: Chat Request Conversion + Tool Calling Correctness

**Objective:** Improve reliability for system prompts, tool calling loops, and tool results.

**Files to Modify/Create:**

- `src/provider.ts`

**Tests to Write:**

- Manual: run a tool-calling scenario in Copilot Chat (function call, tool result, follow-up).

**Steps:**

1. Update `convertRole(...)` to handle additional roles:
   - `System` → `system`
   - `Tool` → `tool`
2. Expand message conversion to support tool call and tool result parts properly:
   - If incoming message contains `LanguageModelToolCallPart`, map it to OpenAI-compatible `tool_calls` on an assistant message.
   - If message contains `LanguageModelToolResultPart`, map it to role `tool` with `tool_call_id`.
3. Fix capability defaults:
   - Replace `model.capabilities?.tools || true` with `model.capabilities?.tools ?? true` (or default to `false` if you want to be strict).
4. Add nicer model picker metadata:
   - Populate `detail`/`tooltip` in `LanguageModelChatInformation` (e.g., context length, “⭐ subscription”, “🖼️ vision”, “🔧 tools”).

**Acceptance Criteria:**

- [ ] Tool calling works across multiple turns without losing tool call context.
- [ ] System messages (if provided by VS Code) are preserved.
- [ ] Model picker shows useful details without being noisy.

---

### Phase 5: SSE Streaming + Error Handling Polish

**Objective:** Make streaming more robust and errors more user-friendly while honoring VS Code serialization constraints.

**Files to Modify/Create:**

- `src/provider.ts`

**Tests to Write:**

- Manual: simulate 401/403/429; ensure messages are clean.

**Steps:**

1. Improve SSE parsing robustness:
   - Handle multi-line SSE events and ignore non-`data:` lines safely.
   - When JSON parsing fails, only ignore if it’s clearly an incomplete fragment; otherwise log to an Output Channel.
2. Add request timeout (e.g., 60–120 seconds configurable), combined with cancellation:
   - AbortController for cancellation, plus timer-based abort for timeouts.
3. Improve error messages:
   - If `response.status === 401`: “Invalid API key” guidance.
   - If `429`: rate limit guidance.
   - Always throw a clean `Error(message)`.
4. Optional: add a dedicated Output Channel (`vscode.window.createOutputChannel("NanoGPT")`) and use it instead of `console.error`.

**Acceptance Criteria:**

- [ ] Cancelling a chat request stops the network request.
- [ ] Timeout aborts produce a clean, actionable error.
- [ ] SSE stream errors (`{ error: ... }`) surface as clean errors.

---

### Phase 6: Command UX and Safety Nets

**Objective:** Improve management commands to feel “finished” and avoid accidental destructive actions.

**Files to Modify/Create:**

- `src/extension.ts`

**Tests to Write:**

- Manual: run commands from management menu.

**Steps:**

1. Fix `nanogpt.selectModels` to `await vscode.window.withProgress(...)` so errors are catchable.
2. Confirm destructive actions:
   - “Enable All Subscription Models” should confirm it will replace current selection (or switch to “add to selection”).
3. Improve quick pick labeling:
   - Keep “⭐ subscription” consistent (currently good).
   - Make pricing display optional/guarded if the units are uncertain.
4. Add “Open NanoGPT API docs” command (optional) and/or improve existing link action copy.

**Acceptance Criteria:**

- [ ] `selectModels` errors are handled reliably.
- [ ] Subscription enable action does not surprise users.

## Open Questions

1. What’s the intended source of truth for API key long-term?
   - **Option A:** Secret Storage only (recommended for security).
   - **Option B:** Allow settings key too (more scriptable, less secure).
   - **Recommendation:** A + one-time migration from settings → secrets.

2. Do you want the release to be purely “polish” (no new commands), or is adding “Clear API Key” acceptable?
   - **Option A:** No new commands; keep surface area minimal.
   - **Option B:** Add “Clear API Key” and improve “Refresh Models” to fetch count.
   - **Recommendation:** B (high UX value, low risk).

3. Should tool calling capability default to `true` when unknown?
   - **Option A:** Default true (current behavior, but potentially misleading).
   - **Option B:** Default false unless known.
   - **Recommendation:** Default true only when the API doesn’t provide capability flags; otherwise respect flags.

## Risks & Mitigation

- **Risk:** VS Code message part types differ across versions.
  - **Mitigation:** Use `instanceof` checks defensively and keep fallbacks to plain text.

- **Risk:** Removing `nanogpt.apiKey` from configuration is breaking for users relying on it.
  - **Mitigation:** Implement migration, and only remove after one or more releases.

- **Risk:** Subscription endpoint may be unstable or permissioned.
  - **Mitigation:** Treat failures as non-fatal; proceed with standard model list.

## Success Criteria

- [ ] API key setup is unambiguous and works whether users used Settings or the command.
- [ ] Config flags `autoFetchModels` and `showSubscriptionModelsFirst` are respected.
- [ ] Tool calling loops work reliably (tool call → tool result → follow-up).
- [ ] Streaming failures produce clean, actionable errors.
- [ ] `npm run compile` passes; manual smoke tests pass in Extension Development Host.

## Notes for Atlas

- Keep changes surgical; avoid large refactors.
- Follow the repo guideline: throw only clean `Error` objects with simple string messages from provider methods.
- Prefer adding an Output Channel for diagnostics over `console.*`.
- After implementation, update `CHANGELOG.md` and verify behavior via F5 Extension Development Host.
