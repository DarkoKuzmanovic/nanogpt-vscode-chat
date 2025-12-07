# AI Agent Instructions for NanoGPT VS Code Extension

This document provides guidelines for AI agents working on this codebase.

## Project Overview

This is a VS Code extension that provides NanoGPT models as language model providers for GitHub Copilot Chat. It uses the VS Code `LanguageModelChatProvider` API to integrate with Copilot.

## Architecture

- **`src/extension.ts`** - Extension entry point, command registration, and activation logic
- **`src/provider.ts`** - Main `NanoGPTChatModelProvider` class implementing the language model provider interface

## Key Technologies

- TypeScript
- VS Code Extension API (specifically `vscode.lm.registerLanguageModelChatProvider`)
- Server-Sent Events (SSE) for streaming responses
- OpenAI-compatible chat completions API

## Development Guidelines

### Error Handling

When throwing errors from the provider methods (especially `provideLanguageModelChatResponse`):

- Always create clean `Error` objects with simple string messages
- Avoid re-throwing errors with complex properties (cause, stack traces) as VS Code may fail to serialize them
- Check for error responses in SSE stream chunks

### API Integration

- The NanoGPT API is OpenAI-compatible at `https://nano-gpt.com/api/v1`
- Subscription models are fetched from a separate endpoint: `https://nano-gpt.com/api/subscription/v1/models`
- Use both `Authorization: Bearer` and `x-api-key` headers for subscription endpoints

### Model Caching

- Models are cached for 5 minutes to reduce API calls
- Use `provider.clearCache()` when settings change
- Default models are provided as fallback when API is unavailable

## Code Style

- Use TypeScript strict mode
- Prefer async/await over raw promises
- Use meaningful variable names
- Add JSDoc comments for public methods

## Testing Changes

1. Run `npm run compile` to check for TypeScript errors
2. Press F5 in VS Code to launch Extension Development Host
3. Test with various models including edge cases (thinking models, subscription models)

## Version Bumping

When requested to bump the version:

1. Update `version` field in `package.json`
2. Update `CHANGELOG.md` with a new section for the version:
   - Add the version number and date as a header: `## [X.Y.Z] - YYYY-MM-DD`
   - Document all changes made since the previous version
   - Categorize changes under: `### Added`, `### Changed`, `### Fixed`, `### Removed` as appropriate
   - Be specific about what was changed and why

## Common Tasks

### Adding a New Model to Defaults

Edit the `DEFAULT_MODELS` array in `provider.ts`.

### Adding New Configuration Options

1. Add to `contributes.configuration.properties` in `package.json`
2. Read using `vscode.workspace.getConfiguration("nanogpt").get<Type>("optionName")`

### Adding New Commands

1. Add to `contributes.commands` in `package.json`
2. Register handler in `extension.ts` using `vscode.commands.registerCommand`

## Files to Update Together

When making changes, consider these related files:

- `package.json` - version, commands, configuration schema
- `CHANGELOG.md` - document changes for each version
- `README.md` - update if features/usage changes
