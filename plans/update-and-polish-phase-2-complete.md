## Phase 2 Complete: API Key Handling & Migration

Implemented consistent, user-proof API key handling with automatic migration from settings to Secret Storage.

**Files created/changed:**
- src/provider.ts
- src/extension.ts
- package.json

**Functions created/changed:**
- `NanoGPTChatModelProvider.getApiKey()` (new) - centralized API key retrieval with migration
- `fetchAvailableModels()` - updated to use `getApiKey()`
- `provideLanguageModelChatInformation()` - updated to use `getApiKey()`
- `provideLanguageModelChatResponse()` - updated to use `getApiKey()`
- `activate()` in extension.ts - added `clearApiKey` command registration
- `nanogpt.manage` command - added "Clear API Key" option
- `nanogpt.selectModels` command - updated to use `provider?.getApiKey()`
- `nanogpt.enableSubscriptionModels` command - updated to use `provider?.getApiKey()`

**Tests created/changed:**
- None (verified with `npm run compile`)

**Review Status:** APPROVED

**Git Commit Message:**
```
feat: implement secure API key handling with automatic migration

- Add centralized getApiKey() method with Secret Storage as source of truth
- Automatically migrate API keys from settings to Secret Storage
- Add "NanoGPT: Clear API Key" command for user convenience
- Update all API key retrieval call sites to use new method
- Mark nanogpt.apiKey setting as deprecated with migration notice
- Maintain backward compatibility with existing configurations
```
