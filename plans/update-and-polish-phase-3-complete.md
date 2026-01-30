## Phase 3 Complete: Respect Settings & Improve Caching

Implemented proper handling of configuration settings and optimized model fetching with in-flight de-duplication.

**Files created/changed:**

- src/provider.ts
- src/extension.ts

**Functions created/changed:**

- `NanoGPTChatModelProvider.modelsFetchPromise` (new property) - tracks in-flight fetches
- `fetchAvailableModels()` - added in-flight de-duplication and respects `showSubscriptionModelsFirst` setting
- `activate()` in extension.ts - added startup auto-fetch when `autoFetchModels` is enabled
- `nanogpt.refreshModels` command - enhanced with progress indicator and model count feedback

**Tests created/changed:**

- None (verified with `npm run compile`)

**Review Status:** APPROVED

**Git Commit Message:**

```
feat: respect configuration settings and optimize model fetching

- Add in-flight de-duplication to prevent concurrent duplicate API calls
- Respect showSubscriptionModelsFirst setting for model sorting
- Implement autoFetchModels setting for startup behavior
- Enhance refresh command with progress indicator and model count
- Improve user feedback throughout model management
```
