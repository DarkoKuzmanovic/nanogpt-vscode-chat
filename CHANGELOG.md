# Changelog

All notable changes to the NanoGPT Provider for GitHub Copilot Chat extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.1] - 2025-12-07

### Fixed

- Fixed `stackTrace.format` error that occurred with some models (e.g., LongCat Flash)
- Improved error handling in SSE stream processing to catch API error responses
- Errors are now re-thrown as clean Error objects to avoid serialization issues with complex error properties

## [0.1.0] - Initial Release

### Added

- Initial release of NanoGPT Provider for GitHub Copilot Chat
- Integration with NanoGPT API for accessing various LLM models
- Support for streaming chat completions
- Model selection UI with subscription model indicators
- Tool calling support
- Vision/image input support for compatible models
- Automatic model fetching with caching
- Commands for managing API key and model selection
