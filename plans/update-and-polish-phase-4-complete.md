## Phase 4 Complete: Chat Conversion & Tool Calling

Improved message conversion to support all roles and proper tool calling across multiple turns.

**Files created/changed:**

- src/provider.ts

**Functions created/changed:**

- `convertRole()` - added support for System and Tool roles
- `convertMessage()` - added support for extracting tool calls and tool results
- `formatModelDetail()` (new) - creates rich model metadata for picker
- `provideLanguageModelChatInformation()` - fixed capability defaults and added detail property

**Tests created/changed:**

- None (verified with `npm run compile`)

**Review Status:** APPROVED

**Git Commit Message:**

```
feat: improve tool calling and message conversion reliability

- Add support for System and Tool message roles
- Extract and format tool calls according to OpenAI spec
- Handle tool result messages with proper tool_call_id
- Fix capability defaults to respect explicit false values
- Add rich model metadata in picker (subscription, context, features)
```
