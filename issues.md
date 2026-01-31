# Issue: Models Not Displaying in Copilot Chat "Pick Model" Section

**Status:** PARTIALLY RESOLVED - Models registered but hidden in UI
**Date:** 2026-01-31
**Last Updated:** 2026-01-31

## Problem

Models from the NanoGPT extension do not appear in VS Code's Copilot Chat model picker, even though:

- Extension is activated
- API key is configured
- User has an individual Copilot plan (Pro/Pro+)
- Running VS Code Insiders 1.109

## KEY FINDING (2026-01-31)

**Models ARE registered in VS Code's language model system but NOT appearing in Copilot Chat picker.**

Diagnostics output shows:

- `vscode.lm.selectChatModels({})` returns **30 models total**
- **6 NanoGPT models are present**: DeepSeek V3.2 Exp, DeepSeek V3.2 Speciale, DeepSeek V3.2 Thinking, GLM 4.7, GLM 4.7 Thinking, Kimi K2.5
- Vendors registered: `copilot`, `nanogpt`
- All 6 NanoGPT models have `vendor: nanogpt`

**Conclusion:** The extension IS working correctly. VS Code's API sees the models. The issue is likely:

1. **Language Models Editor visibility toggle** - Models may be hidden by default
2. **Copilot Chat picker filtering** - May only show `vendor: copilot` models

## Recommended Fix Steps

1. Open Command Palette → **"Chat: Manage Language Models"**
2. Find the NanoGPT models (DeepSeek, GLM, Kimi)
3. Toggle the **visibility (eye icon)** to ON for each model

If that doesn't work, the issue is in Copilot Chat's model picker UI filtering - which would be a VS Code limitation, not an extension bug.

## Investigation Summary

### 1. API Research

Reviewed VS Code 1.104 and 1.105 release notes. The `LanguageModelChatProvider` API was finalized in 1.104. Key finding from docs:

> "Models provided through this API are currently only available to users on individual GitHub Copilot plans."

User confirmed they have an individual plan, so this is **not** the cause.

### 2. VS Code 1.106+ Changes (NEW)

Researched VS Code versions 1.106, 1.107, 1.108, and 1.109 (Insiders). Found several significant changes that may affect third-party language model providers:

#### 1.106 - Language Models Editor (Preview)

- New centralized Language Models editor for managing all chat models
- **Model visibility toggle** - Models can be hidden from the picker with an eye icon
- Third-party models may need to be explicitly made visible

#### 1.107 - Copilot Extension Unification (IMPORTANT)

- **GitHub Copilot extension consolidated into GitHub Copilot Chat extension**
- Quote: "The GitHub Copilot extension will be disabled by default for all users"
- This consolidation may affect how third-party providers are loaded/displayed
- Setting `chat.extensionUnification.enabled` controls this behavior

#### 1.107 - Language Models Editor GA

- Language Models editor widely available
- Settings: `@provider:`, `@capability:`, `@visible:` filters
- **Third-party models may default to hidden**

#### 1.108+ - Agent Sessions Integration

- Focus on Agent Sessions and background agents
- No breaking changes to LanguageModelChatProvider API observed

### 3. Code Analysis

Compared extension code with [official sample](https://github.com/microsoft/vscode-extension-samples/tree/main/chat-model-provider-sample).

#### Issues Found & Fixed (Previous)

| Issue                                                                    | Status   |
| ------------------------------------------------------------------------ | -------- |
| Missing `onDidChangeLanguageModelChatInformation` event                  | ✅ Fixed |
| Returning `[]` when no API key set (caused VS Code to cache "no models") | ✅ Fixed |
| Added diagnostic logging                                                 | ✅ Fixed |

#### New Diagnostic Enhancements

| Enhancement                                      | Status   |
| ------------------------------------------------ | -------- |
| Detailed activation logging with VS Code version | ✅ Added |
| Provider registration success/failure logging    | ✅ Added |
| Detailed model return value logging              | ✅ Added |
| New `nanogpt.diagnostics` command                | ✅ Added |
| Query vscode.lm.selectChatModels for visibility  | ✅ Added |

### 4. Potential Root Causes (Prioritized)

1. **Model visibility in Language Models Editor** - Third-party models may be hidden by default in 1.106+
2. **Copilot extension unification (1.107+)** - May affect third-party provider registration
3. **Provider registration timing** - May need to fire event after registration
4. **Silent mode always true** - VS Code may be calling with silent=true only
5. **Extension not activating** - Activation events may not be triggering

## Diagnostic Steps (Updated)

### Step 1: Run Diagnostics Command

```
Command Palette → "NanoGPT: Run Diagnostics"
```

This will output:

- VS Code version
- API key status
- Selected models configuration
- **All language models visible to VS Code**
- **NanoGPT models found in VS Code's model list**
- All vendor names registered

### Step 2: Check Language Models Editor (1.106+)

```
Command Palette → "Chat: Manage Language Models"
```

- Look for NanoGPT models in the list
- Check if they have the visibility toggle enabled (eye icon)
- If hidden, toggle visibility ON

### Step 3: Check Extension Activation

```
Output Panel → Extension Host → search for "NanoGPT"
```

Look for:

- `[Activation] NanoGPT extension activating on VS Code X.X.X`
- `[Activation] ✓ Provider registration returned successfully`

### Step 4: Check Provider Calls

```
Output Panel → NanoGPT
```

Look for:

- `[Debug] provideLanguageModelChatInformation called`
- `[Debug] Returning X LanguageModelChatInformation objects`

### Step 5: Check Copilot Unification (1.107+)

If using VS Code 1.107+, try:

```json
"chat.extensionUnification.enabled": false
```

This reverts to the old Copilot extension behavior and may help identify if the unification is the issue.

### Step 6: Test on Fresh Profile

```bash
code-insiders --profile temp
```

Install extension fresh, set API key, and check if models appear.

## Next Steps Based on Diagnostics

### If diagnostics show 0 NanoGPT models in vscode.lm.languageModels:

1. Provider registration is failing silently OR
2. provideLanguageModelChatInformation is not being called
3. Check Extension Host logs for errors

### If diagnostics show NanoGPT models but they're not in picker:

1. Models are hidden in Language Models Editor
2. Open Language Models Editor and enable visibility

### If provideLanguageModelChatInformation is never called:

1. There may be a timing issue with the event emitter
2. Try adding a delay and firing the change event after activation

## Files Changed

- `extension.ts` - Enhanced activation logging, added `nanogpt.diagnostics` command
- `provider.ts` - Enhanced provideLanguageModelChatInformation logging
- `package.json` - Added diagnostics command registration
