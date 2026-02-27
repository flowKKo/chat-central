# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.1] - 2026-02-27

### Added

- Platform filter in Spotlight search — press Tab to cycle through All / Claude / ChatGPT / Gemini
- Colored pill badge showing active platform between search icon and input field
- Filter auto-resets when Spotlight is closed and reopened

## [0.2.0] - 2026-02-26

### Added

- Spotlight search (Cmd/Ctrl+Shift+K) for quick conversation lookup
- Spotlight popup window fallback for restricted pages (chrome://, extensions)
- Auto-close spotlight popup on focus loss
- Zod validation for message boundaries in background handlers
- Unit tests for background modules (schemas, urlParser)
- Unit tests for conversation components (MessageBubble, ConversationListItem)
- ESLint, Prettier, and pre-commit hooks configuration
- Commitlint for conventional commit messages

### Changed

- Refactored `gemini.ts` into smaller focused modules (constants, types, payload, utils, list, detail)
- Refactored `background/index.ts` into handlers and services
- Refactored `db/index.ts` into repository modules
- Refactored `ConversationsManager.tsx` into smaller components
- Extracted shared filtering/sorting logic into reusable utilities
- Extracted common platform adapter utilities

## [0.1.0] - 2026-01-23

### Added

- Initial release
- Support for Claude, ChatGPT, and Gemini platforms
- Automatic conversation capture via network interception
- Local storage with IndexedDB (Dexie)
- Full-text search across conversations and messages
- Search result highlighting
- Favorite conversations feature
- Light/Dark/System theme support
- Context menu for quick actions
- Conversation export (JSON format)
- Development reload server for faster iteration

### Technical

- Built with WXT (Web Extension Tools)
- React 19 with TypeScript
- Jotai for state management
- TailwindCSS for styling
- Vitest for testing

[Unreleased]: https://github.com/flowKKo/chat-central/compare/v0.2.1...HEAD
[0.2.1]: https://github.com/flowKKo/chat-central/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/flowKKo/chat-central/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/flowKKo/chat-central/releases/tag/v0.1.0
