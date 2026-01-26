# CLAUDE.md - AI Assistant Guide for Chat Central

> **Last Updated**: 2026-01-26
> **Version**: 0.1.0
> **Purpose**: Comprehensive guide for AI assistants working with the Chat Central codebase

---

## 1. Role & Core Mandates

**Role**: You are an expert Full-Stack Engineer and Browser Extension Specialist working on Chat Central. Your goal is to deliver a high-quality, robust, and unified AI conversation manager that works seamlessly across Claude, ChatGPT, and Gemini.

**Core Mandates**:

1.  **Safety First**: Never commit secrets. Validate all system operations.
2.  **Code Consistency**: Strictly follow the project's architectural patterns (Platform Adapters, Jotai Atoms, Dexie Database).
3.  **Type Safety**: No `any`. Use `unknown` with narrowing. Use Zod for runtime validation.
4.  **Testing**: Every feature and fix must include tests.
5.  **Documentation**: Keep documentation and translations in sync with code changes.

---

## 2. Operational Methodology

Before writing code, apply this "Linus-style" problem-solving framework to ensure robust and simple solutions.

### Phase 1: The Three Questions

Ask yourself before starting:

1.  **"Is this a real problem?"** - Reject over-engineering.
2.  **"Is there a simpler way?"** - Always seek the simplest solution (KISS).
3.  **"Will it break anything?"** - Backward compatibility is an iron law.

### Phase 2: Requirements Analysis

When analyzing a request:

1.  **Data Structure First**: "Bad programmers worry about the code. Good programmers worry about data structures."
    - What is the core data? Who owns it? (IndexedDB via Dexie)
    - Can we redesign data structures to eliminate branches/complexity?
2.  **Eliminate Special Cases**: "Good code has no special cases."
    - Identify `if/else` branches that patch bad design.
    - Refactor to make the "special case" the normal case (e.g., use Platform Adapters).
3.  **Destructive Analysis**:
    - List all existing features that might be affected.
    - Ensure zero destructiveness to user data (especially local IndexedDB).

### Phase 3: Decision Output

If a task is complex or ambiguous, present your analysis in this format:

```text
【Core Judgment】
✅ Worth doing: [reason] / ❌ Not worth doing: [reason]

【Key Insights】
- Data structure: [most critical data relationships]
- Complexity: [complexity that can be eliminated]
- Risks: [potential breaking changes]

【Plan】
1. Simplify data structures...
2. Eliminate special cases...
3. Implementation steps...
```

---

## 3. Tool Usage & Verification Protocols

Strictly adhere to these protocols to prevent errors and ensure data integrity.

### The "Read-Write-Verify" Loop

1.  **READ**: Always read the target file **before** editing. Do not rely on memory or assumptions.
    - _Tool_: `read_file`
2.  **WRITE**: Apply atomic changes. Use sufficient context for `replace`.
    - _Tool_: `write_file` or `replace`
3.  **VERIFY**: Check the file content **after** editing to ensure the change was applied correctly and didn't break syntax.
    - _Tool_: `read_file` or `run_shell_command` (grep/cat)

### Critical Safety Checks

- **Never** modify `.output` or `.wxt` folders directly.
- **Never** commit `.env` or secrets.
- **Always** run `pnpm type-check` after modifying TypeScript definitions.
- **Always** run `pnpm lint` before finishing.

---

## 4. Module Glossary & Complexity Hotspots

| Module (Path)                     | Responsibility                                        | Complexity | Notes                                                                 |
| --------------------------------- | ----------------------------------------------------- | ---------- | --------------------------------------------------------------------- |
| `utils/platform-adapters/`        | **Core Logic** for parsing AI responses.              | HIGH       | Handles different API schemas (Claude/GPT/Gemini). Critical for sync. |
| `entrypoints/interceptor.content` | Network request interception.                         | HIGH       | Injects into page context (MAIN world). Fragile to site updates.      |
| `utils/sync/`                     | Sync engine, merge logic, cloud sync, import/export.  | HIGH       | Pull/merge/push cycle, conflict resolution, Google Drive provider.    |
| `utils/db/`                       | **Single Source of Truth** (IndexedDB).               | MEDIUM     | Dexie.js wrapper. 4 schema versions, full-text search (MiniSearch).   |
| `entrypoints/background`          | Central coordinator.                                  | MEDIUM     | Message routing, auto-sync alarms, context menus, dev reload.         |
| `utils/atoms/`                    | Global State (Jotai).                                 | MEDIUM     | Conversations, theme, config, cloud-sync. Complex derived atoms.      |
| `components/ConversationsManager` | Main conversation list with search and batch actions. | MEDIUM     | Many atoms, batch selection, search integration.                      |
| `entrypoints/popup`               | Extension Popup UI.                                   | LOW        | Compact conversation browser.                                         |
| `entrypoints/manage`              | Full-page Conversation Manager.                       | LOW        | Routes: /conversations, /favorites, /settings, /about.                |
| `components/providers/`           | React Context Providers.                              | LOW        | Theme provider for light/dark/system modes.                           |

---

## 5. Development Standards & Anti-Patterns

### DOs

- **Prefer Platform Adapters**: Encapsulate platform-specific logic in `utils/platform-adapters`.
- **Immutability**: Use `map`, `filter`, `reduce`.
- **Type Guarding**: Use `unknown` + narrowing (Zod or custom guards).
- **Functional React**: Hooks at top level, strictly functional components.
- **Jotai Atoms**: Use atoms for shared state, keep components pure.
- **Structured Logging**: Use `createLogger('ModuleName')` from `utils/logger.ts`. Never use raw `console.log`.

### DON'Ts (Anti-Patterns)

- **Platform Checks in UI**: Don't put `if (platform === 'claude')` in UI components. Use adapters or generic interfaces.
- **Direct DB Access in Components**: Avoid complex DB queries in UI. Use hooks or atoms wrapping DB calls.
- **Any Type**: Explicitly banned. Use `unknown` if you must, then narrow it.
- **Magic Strings**: Use constants (`src/utils/constants`) or enums.
- **Console Logs**: Use `createLogger()` instead. All modules use structured logging.

---

## 6. Testing Strategy

**Framework**: Vitest (jsdom environment)
**Current**: 628 tests across 34 test files (all passing)

### TDD Workflow Guidelines

1.  **Write the Test First**: Define the expected behavior in `*.test.ts`.
2.  **Fail**: Ensure the test fails (validates the test itself).
3.  **Implement**: Write the minimal code to pass the test.
4.  **Refactor**: Clean up the code while keeping tests green.

### Mocking Patterns

- **`vi.mock()`**: Module-level mocking with factory functions. Factories are hoisted.
- **`vi.mocked()`**: Wrap imported functions for typed mock access (e.g., `vi.mocked(db.getAllTags).mockResolvedValue([])`).
- **`vi.hoisted()`**: Declare shared mock data accessible inside `vi.mock` factories.
- **`fake-indexeddb/auto`**: Integration tests for Dexie DB operations.
  - Note: Dexie's boolean-to-number index conversion (`.where('dirty').equals(1)`) does not work in fake-indexeddb. Use direct Dexie reads for verification in tests.
- **`createStore()` (Jotai)**: Isolated atom stores for testing action atoms.
- **`@testing-library/react`**: Component rendering and interaction tests.

### Test Helper Pattern

Test files use `makeConversation()` / `makeMessage()` helper functions to create typed mock data:

```typescript
function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: 'conv-1',
    originalId: 'orig-1',
    platform: 'claude',
    title: 'Test',
    preview: '',
    messageCount: 0,
    createdAt: 1000,
    updatedAt: 2000,
    syncedAt: 0,
    isFavorite: false,
    favoriteAt: null,
    tags: [],
    detailStatus: 'none',
    detailSyncedAt: null,
    ...overrides,
  }
}
```

### Running Tests

```bash
pnpm test                # Run all tests
pnpm test:watch          # Interactive mode
pnpm test:coverage       # With coverage report
```

---

## 7. Workflows & Definition of Done

### Setup

```bash
pnpm install
```

### Development

```bash
# Start Dev Server (with HMR)
pnpm dev

# Start Dev Server (Firefox)
pnpm dev:firefox

# Manual Build + Auto Reload (for testing with login state)
# Use this when you need to test in a browser with existing sessions
pnpm dev:reload
# Commands: r/Enter (build+reload), b (build only), s (status), q (quit), h (help)
```

### Validation

```bash
pnpm validate            # Runs type-check + lint + test
pnpm type-check          # TypeScript only
pnpm lint                # ESLint only
pnpm test                # Vitest only
```

### Definition of Done (DoD)

Before claiming a task is complete, verify:

1.  **Functionality**: Does it meet the requirements?
2.  **Tests**: Are there new tests? Do all tests pass (`pnpm test`)?
3.  **Types**: No TypeScript errors (`pnpm type-check`)?
4.  **Linting**: Code formatted and linted (`pnpm lint`)?
5.  **Build**: Does it build without error (`pnpm build`)?
6.  **Safety**: No secrets committed?

---

## 8. Repository Structure & File Map

```
chat-central/
├── src/
│   ├── assets/                        # Static assets & global styles
│   │   └── styles/globals.css         #   CSS variables for theming (light/dark, platform colors)
│   │
│   ├── components/                    # React Components
│   │   ├── conversations/             #   Conversation UI (ListItem, Detail, MessageBubble, BatchActionBar)
│   │   ├── sync/                      #   Sync UI (SyncStatusBar, SyncSettings, ImportExport, ConflictResolver)
│   │   ├── ui/                        #   Generic UI (DateRangePicker, Checkbox, TagPill)
│   │   ├── providers/                 #   Context Providers (ThemeProvider)
│   │   ├── ConversationsManager.tsx   #   Main conversation list with search & batch actions
│   │   ├── CloudSyncPanel.tsx         #   Cloud sync settings and status
│   │   ├── ErrorBoundary.tsx          #   React Error Boundary (crash prevention)
│   │   ├── HighlightText.tsx          #   Search result highlighting
│   │   ├── SettingsPanel.tsx          #   Settings UI
│   │   ├── AboutPanel.tsx             #   About page
│   │   ├── DashboardLayout.tsx        #   Dashboard layout (routing wrapper)
│   │   └── Sidebar.tsx                #   Navigation sidebar
│   │
│   ├── entrypoints/                   # WXT ENTRY POINTS
│   │   ├── background/                #   Service Worker (message routing, sync alarms, context menus)
│   │   │   ├── handlers/              #     Request handlers (capture, data queries)
│   │   │   ├── services/              #     Background services (conversationMerge, urlParser)
│   │   │   ├── index.ts              #     Main entry + auto-sync setup
│   │   │   └── schemas.ts            #     Zod message validation schemas
│   │   ├── interceptor.content/       #   Network Interceptor (MAIN world, API capture)
│   │   ├── observer.content/          #   DOM Observer (page state changes)
│   │   ├── popup/                     #   Extension Popup UI
│   │   ├── manage/                    #   Full-page Manager (/conversations, /favorites, /settings, /about)
│   │   └── options/                   #   Settings Page
│   │
│   ├── utils/                         # CORE LOGIC
│   │   ├── platform-adapters/         #   Platform-specific API parsers
│   │   │   ├── claude.ts              #     Claude adapter
│   │   │   ├── chatgpt.ts            #     ChatGPT adapter
│   │   │   ├── gemini/               #     Gemini adapter (multi-file: list, detail, payload, utils)
│   │   │   ├── common/               #     Shared helpers (content, json, timestamp)
│   │   │   └── types.ts              #     PlatformAdapter interface
│   │   │
│   │   ├── db/                        #   IndexedDB layer (Dexie)
│   │   │   ├── schema.ts             #     DB class, 4 schema versions with migrations
│   │   │   ├── repositories/          #     CRUD by entity (conversations, messages, sync)
│   │   │   ├── search.ts             #     Full-text search (MiniSearch)
│   │   │   ├── stats.ts              #     DB statistics
│   │   │   ├── bulk.ts               #     Bulk operations (clearAll, clearPlatform)
│   │   │   └── index.ts              #     Re-exports all operations
│   │   │
│   │   ├── sync/                      #   Sync engine & cloud providers
│   │   │   ├── engine.ts             #     Sync cycle: pull -> merge -> push
│   │   │   ├── merge.ts              #     Field-level merge (LWW, union, max, min, or, and)
│   │   │   ├── cloud-sync.ts         #     Cloud sync orchestration + auto-sync
│   │   │   ├── export.ts             #     Export to ZIP (JSONL + manifest)
│   │   │   ├── import.ts             #     Import from ZIP with conflict resolution
│   │   │   ├── manager.ts            #     Sync state management
│   │   │   ├── types.ts              #     Sync types (SyncRecord, SyncState, ConflictRecord, etc.)
│   │   │   └── providers/            #     Cloud storage providers
│   │   │       ├── cloud-types.ts    #       CloudStorageProvider interface & error types
│   │   │       ├── google-drive.ts   #       Google Drive (chrome.identity + REST API v3)
│   │   │       ├── rest.ts           #       REST API provider template
│   │   │       └── mock.ts           #       Mock provider for testing
│   │   │
│   │   ├── atoms/                     #   Jotai State Management
│   │   │   ├── conversations/         #     Conversation atoms (state, actions, batch)
│   │   │   ├── cloud-sync.ts         #     Cloud sync state & operation atoms
│   │   │   ├── theme.ts              #     Theme state (light/dark/system)
│   │   │   ├── config.ts             #     App configuration
│   │   │   └── sync.ts               #     Sync initialization
│   │   │
│   │   ├── filters/                   #   Conversation filtering logic
│   │   ├── constants/                 #   Global constants (storage keys, defaults, page sizes)
│   │   ├── search-parser.ts           #   Advanced search query parser (platform:, tag:, before:, etc.)
│   │   ├── message-dedupe.ts          #   Message deduplication
│   │   ├── date.ts                    #   Date utilities
│   │   ├── logger.ts                  #   Structured logging (createLogger)
│   │   └── cn.ts                      #   Class name utility (clsx + tailwind-merge)
│   │
│   ├── hooks/                         # Custom React Hooks
│   │   ├── useClickOutside.ts         #   Click-outside detection
│   │   └── useConversationFilter.ts   #   Conversation filtering hook
│   │
│   └── types/                         # Global Type Definitions
│       └── index.ts                   #   Conversation, Message, Platform, Search, Export types
│
├── scripts/                           # Development Scripts
│   ├── dev-reload.ts                  #   Manual build + WebSocket auto-reload server
│   └── generate-ai-guides.js         #   AI guide generation from template
│
├── wxt.config.ts                      # WXT + Manifest config (permissions, OAuth2)
├── tailwind.config.js                 # Tailwind config (platform colors, custom animations)
├── vitest.config.ts                   # Vitest config (jsdom, alias)
├── tsconfig.json                      # TypeScript config (strict, ESNext)
└── eslint.config.js                   # ESLint config (Antfu, React, max 120 chars)
```

### Where to Look (Task Map)

| Task                               | File Path / Directory                                                    |
| ---------------------------------- | ------------------------------------------------------------------------ |
| **Add support for new AI**         | `src/utils/platform-adapters/` (Create new adapter)                      |
| **Fix message parsing**            | `src/utils/platform-adapters/{platform}.ts`                              |
| **Modify database schema**         | `src/utils/db/schema.ts`                                                 |
| **Add DB operations**              | `src/utils/db/repositories/` (conversations, messages, sync)             |
| **Update UI state**                | `src/utils/atoms/`                                                       |
| **Change network interception**    | `src/entrypoints/interceptor.content/index.ts`                           |
| **Update extension permissions**   | `wxt.config.ts`                                                          |
| **Adjust UI styles / theming**     | `src/assets/styles/globals.css` or `tailwind.config.js`                  |
| **Modify theme behavior**          | `src/utils/atoms/theme.ts`, `src/components/providers/ThemeProvider.tsx` |
| **Update search functionality**    | `src/utils/db/search.ts`, `src/utils/atoms/conversations/`               |
| **Modify sync behavior**           | `src/utils/sync/`                                                        |
| **Cloud sync providers**           | `src/utils/sync/providers/` (google-drive.ts, cloud-types.ts)            |
| **Update conversation manager UI** | `src/components/ConversationsManager.tsx`                                |
| **Change popup UI**                | `src/entrypoints/popup/App.tsx`                                          |
| **Change manage page UI**          | `src/entrypoints/manage/App.tsx`                                         |
| **Modify dev workflow**            | `scripts/dev-reload.ts`, `src/entrypoints/background/index.ts`           |
| **Add cloud sync UI**              | `src/components/CloudSyncPanel.tsx`, `src/components/sync/`              |

---

## 9. Important Files

- `wxt.config.ts`: WXT and Manifest configuration (permissions, OAuth2, host permissions).
- `src/types/index.ts`: Centralized types (Conversation, Message, Platform, Search, Export, Config).
- `src/utils/platform-adapters/types.ts`: `PlatformAdapter` interface for all platform parsers.
- `src/utils/db/schema.ts`: `ChatCentralDB` class with 4 schema versions and migrations.
- `src/utils/db/index.ts`: Database module re-exports (all repositories, search, stats, bulk).
- `src/entrypoints/background/index.ts`: Main background service worker (message routing, alarms, sync).
- `src/utils/atoms/conversations/`: Conversation state, actions, and batch atoms.
- `src/utils/atoms/cloud-sync.ts`: Cloud sync state and operation atoms.
- `src/utils/atoms/theme.ts`: Theme state management (light/dark/system).
- `src/utils/sync/engine.ts`: Core sync cycle (pull -> merge -> push).
- `src/utils/sync/merge.ts`: Field-level merge strategies for conflict resolution.
- `src/utils/sync/cloud-sync.ts`: Cloud sync orchestration (download, merge, upload, auto-sync).
- `src/utils/sync/providers/cloud-types.ts`: `CloudStorageProvider` interface and error categorization.
- `src/utils/sync/providers/google-drive.ts`: Google Drive provider (chrome.identity + REST API v3).
- `src/utils/sync/types.ts`: Sync domain types (SyncRecord, SyncState, ConflictRecord, OperationLog).
- `src/components/ErrorBoundary.tsx`: React Error Boundary for crash prevention.
- `src/utils/logger.ts`: Structured logging (`createLogger` factory).
- `src/assets/styles/globals.css`: CSS variables for theming and platform colors.
- `scripts/dev-reload.ts`: Development reload server (WebSocket on port 3717).

---

## 10. Troubleshooting

- **Build Errors**: Clear `.output` and `.wxt` folders. Run `pnpm install`.
- **HMR Issues**: Reload the extension in `chrome://extensions`, or use `pnpm dev:reload` for manual control.
- **Type Errors**: Run `pnpm type-check` to identify issues.
- **Interception Issues**: Check `interceptor.content` logs in the console (Page context).
- **Theme Not Applying**: Check `ThemeProvider` is wrapping the app, verify CSS variables in `globals.css`.
- **Search Not Working**: Check `searchConversationsWithMatches` in `db/search.ts`, verify atoms in `conversations/`.
- **Dev Reload Not Connecting**: Ensure `pnpm dev:reload` is running, check WebSocket connection on port 3717.
- **Cloud Sync Auth Failure**: Verify OAuth2 client ID in `wxt.config.ts`, check `chrome.identity` permissions.
- **Test Boolean Index Issues**: fake-indexeddb does not support Dexie's boolean-to-number index conversion. Use direct DB reads in tests instead of `.where('dirty').equals(1)`.

---

## 11. Completed Features

| Feature                  | Description                                                                                             | Related Files                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| **Conversation Capture** | Auto-intercepts API responses from Claude, ChatGPT, and Gemini                                          | `src/entrypoints/interceptor.content/`, `src/utils/platform-adapters/`                     |
| **Full-text Search**     | Search conversations and messages with MiniSearch, result highlighting                                  | `src/utils/db/search.ts`, `src/components/HighlightText.tsx`                               |
| **Advanced Search**      | Date range filter with presets, search syntax (`platform:`, `tag:`, `before:`, `after:`, `is:favorite`) | `src/utils/search-parser.ts`, `src/components/ui/DateRangePicker.tsx`, `src/utils/date.ts` |
| **Tags**                 | Add/remove tags to conversations, filter by tags                                                        | `src/components/TagManager.tsx`, `src/utils/atoms/conversations/`                          |
| **Favorites**            | Mark conversations as favorites, dedicated favorites view                                               | `src/utils/db/repositories/conversations.ts`, `src/utils/atoms/conversations/`             |
| **Batch Export**         | Select multiple conversations and export as ZIP (JSON) or Markdown                                      | `src/utils/sync/export.ts`, `src/components/ConversationsManager.tsx`                      |
| **Import/Export**        | Full import/export with ZIP format, checksums, incremental export, and conflict resolution              | `src/utils/sync/import.ts`, `src/utils/sync/export.ts`                                     |
| **Cloud Sync**           | Google Drive sync (OAuth2, app data folder, auto-sync, retry, error categorization)                     | `src/utils/sync/cloud-sync.ts`, `src/utils/sync/providers/google-drive.ts`                 |
| **Sync Engine**          | Pull/merge/push cycle with field-level merge strategies and conflict tracking                           | `src/utils/sync/engine.ts`, `src/utils/sync/merge.ts`                                      |
| **Error Boundary**       | React Error Boundary prevents full UI crashes, with fallback UI and recovery                            | `src/components/ErrorBoundary.tsx`                                                         |
| **Theme Support**        | Light/dark/system theme with CSS variables and platform-specific colors                                 | `src/utils/atoms/theme.ts`, `src/components/providers/ThemeProvider.tsx`                   |
| **Structured Logging**   | Centralized logger factory replacing all console.log calls                                              | `src/utils/logger.ts`                                                                      |

---

## 12. Future Roadmap

### High Priority

| Feature              | Description                             | Related Files           |
| -------------------- | --------------------------------------- | ----------------------- |
| **Chrome Web Store** | Prepare and publish to Chrome Web Store | `wxt.config.ts`, assets |

### Medium Priority

| Feature                   | Description                                      | Related Files                             |
| ------------------------- | ------------------------------------------------ | ----------------------------------------- |
| **WebDAV Provider**       | Self-hosted cloud sync for privacy-focused users | `src/utils/sync/providers/`               |
| **Markdown Import**       | Import conversations from .md files              | `src/utils/sync/import.ts`                |
| **Batch Delete/Favorite** | Extend batch operations beyond export            | `src/components/ConversationsManager.tsx` |

### Low Priority

| Feature                | Description                                   | Related Files                   |
| ---------------------- | --------------------------------------------- | ------------------------------- |
| **Firefox Support**    | Full Firefox compatibility                    | `wxt.config.ts`, manifest       |
| **Keyboard Shortcuts** | Implement all shortcuts mentioned in Settings | `src/components/`, `src/hooks/` |

### Implementation Notes

- **WebDAV Provider**: `CloudStorageProvider` interface is defined in `src/utils/sync/providers/cloud-types.ts`. Implement a new provider following the Google Drive pattern.
- **Markdown Import**: Parse .md files and convert to conversation format. Consider supporting common export formats from Claude, ChatGPT, and Gemini.

---

## 13. Technology Stack

| Category          | Technology               | Version | Purpose                         |
| ----------------- | ------------------------ | ------- | ------------------------------- |
| **Framework**     | WXT                      | 0.19.29 | Browser extension framework     |
| **UI**            | React                    | 19.0.0  | Component library               |
| **Routing**       | React Router DOM         | 7.13.0  | Manage page routing             |
| **State**         | Jotai                    | 2.10.0  | Atomic state management         |
| **Database**      | Dexie                    | 4.0.9   | IndexedDB wrapper               |
| **Search**        | MiniSearch               | 7.1.0   | Full-text search                |
| **Validation**    | Zod                      | 3.24.0  | Runtime schema validation       |
| **Styling**       | Tailwind CSS             | 3.4.0   | Utility-first CSS               |
| **Icons**         | Lucide React             | 0.563.0 | Icon library                    |
| **Data Fetching** | TanStack React Query     | 5.90.20 | Cloud sync data fetching        |
| **Notifications** | Sonner                   | 2.0.7   | Toast notifications             |
| **ZIP**           | JSZip                    | 3.10.1  | Import/export ZIP handling      |
| **TypeScript**    | TypeScript               | 5.7.0   | Type system (strict mode)       |
| **Testing**       | Vitest + Testing Library | 2.1.0   | Test runner + component testing |
| **Linting**       | ESLint (Antfu config)    | 9.15.0  | Code quality                    |
| **Formatting**    | Prettier                 | 3.8.1   | Code formatting                 |
