# GEMINI.md - AI Assistant Guide for Chat Central

<!--
This file is generated from AI_GUIDE.template.md.
Do not edit directly; update the template and run `bun run generate:ai-guides`.
-->

> **Last Updated**: 2026-01-23
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

### 🛡️ The "Read-Write-Verify" Loop

1.  **READ**: Always read the target file **before** editing. Do not rely on memory or assumptions.
    - _Tool_: `read_file`
2.  **WRITE**: Apply atomic changes. Use sufficient context for `replace`.
    - _Tool_: `write_file` or `replace`
3.  **VERIFY**: Check the file content **after** editing to ensure the change was applied correctly and didn't break syntax.
    - _Tool_: `read_file` or `run_shell_command` (grep/cat)

### 🚨 Critical Safety Checks

- **Never** modify `.output` or `.wxt` folders directly.
- **Never** commit `.env` or secrets.
- **Always** run `pnpm type-check` after modifying TypeScript definitions.
- **Always** run `pnpm lint` before finishing.

---

## 4. Module Glossary & Complexity Hotspots

| Module (Path)                     | Responsibility                           | Complexity | Notes                                                                 |
| --------------------------------- | ---------------------------------------- | ---------- | --------------------------------------------------------------------- |
| `utils/platform-adapters/`        | **Core Logic** for parsing AI responses. | 🌶️ High    | Handles different API schemas (Claude/GPT/Gemini). Critical for sync. |
| `entrypoints/interceptor.content` | Network request interception.            | 🌶️ High    | Injects into page context (MAIN world). Fragile to site updates.      |
| `utils/sync/`                     | Sync engine, merge logic, import/export. | 🌶️ High    | Handles data synchronization and conflict resolution.                 |
| `utils/db/`                       | **Single Source of Truth** (IndexedDB).  | 🟡 Medium  | Wrapper around Dexie.js. Handles persistence and search.              |
| `entrypoints/background`          | Central coordinator.                     | 🟡 Medium  | Handles messages, triggers DB updates, dev reload.                    |
| `utils/atoms/`                    | Global State (Jotai).                    | 🟢 Low     | React state management (conversations, theme, config, sync).          |
| `entrypoints/popup`               | Extension Popup UI.                      | 🟢 Low     | Main user interface with search.                                      |
| `entrypoints/manage`              | Full-page Conversation Manager.          | 🟢 Low     | Detailed conversation view with search highlighting.                  |
| `components/providers/`           | React Context Providers.                 | 🟢 Low     | Theme provider for light/dark/system modes.                           |

---

## 5. Development Standards & Anti-Patterns

### ✅ DOs

- **Prefer Platform Adapters**: Encapsulate platform-specific logic in `utils/platform-adapters`.
- **Immutability**: Use `map`, `filter`, `reduce`.
- **Type Guarding**: Use `unknown` + narrowing (Zod or custom guards).
- **Functional React**: Hooks at top level, strictly functional components.
- **Jotai Atoms**: Use atoms for shared state, keep components pure.

### ❌ DON'Ts (Anti-Patterns)

- **Platform Checks in UI**: Don't put `if (platform === 'claude')` in UI components. Use adapters or generic interfaces.
- **Direct DB Access in Components**: Avoid complex DB queries in UI. Use hooks or atoms wrapping DB calls.
- **Any Type**: Explicitly banned. Use `unknown` if you must, then narrow it.
- **Magic Strings**: Use constants (`src/utils/constants`) or enums.
- **Console Logs**: Remove `console.log` in production code.

---

## 6. Testing Strategy

**Framework**: Vitest (jsdom environment)

### TDD Workflow Guidelines

1.  **Write the Test First**: Define the expected behavior in `*.test.ts`.
2.  **Fail**: Ensure the test fails (validates the test itself).
3.  **Implement**: Write the minimal code to pass the test.
4.  **Refactor**: Clean up the code while keeping tests green.

### Mocking Patterns

This project uses `wxt` testing utilities and `vi.mock`.

**Running Tests**:

```bash
pnpm test                # Run all tests
pnpm test:watch          # Interactive mode
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
│   ├── assets/                   # Static assets & global styles
│   │   └── styles/globals.css    #   - CSS variables for theming (light/dark)
│   │
│   ├── components/               # React Components
│   │   ├── ui/                   #   - Generic UI (Button, Input)
│   │   ├── shadcn/               #   - Shadcn UI components
│   │   ├── providers/            #   - Context Providers (ThemeProvider)
│   │   ├── sync/                 #   - Sync-related components
│   │   ├── ConversationsManager.tsx  # Full conversation manager with search
│   │   ├── HighlightText.tsx     #   - Search result highlighting
│   │   ├── SettingsPanel.tsx     #   - Settings UI
│   │   ├── AboutPanel.tsx        #   - About page
│   │   ├── DashboardLayout.tsx   #   - Dashboard layout wrapper
│   │   └── Sidebar.tsx           #   - Navigation sidebar
│   │
│   ├── entrypoints/              # 🚪 WXT ENTRY POINTS
│   │   ├── background/           #   - Service Worker (Coordinator + Dev Reload)
│   │   ├── interceptor.content/  #   - Network Interceptor (Page Context)
│   │   ├── observer.content/     #   - DOM Observer (Content Script)
│   │   ├── popup/                #   - Main Extension UI (compact view)
│   │   ├── manage/               #   - Full-page Conversation Manager
│   │   └── options/              #   - Settings Page
│   │
│   ├── utils/                    # 🧠 CORE LOGIC
│   │   ├── platform-adapters/    #   - Platform-specific parsing logic (Crucial)
│   │   ├── db/                   #   - IndexedDB (Dexie) wrapper + search
│   │   ├── atoms/                #   - Jotai State (conversations, theme, config, sync)
│   │   ├── sync/                 #   - Sync engine, merge, import/export
│   │   ├── constants/            #   - Global constants
│   │   └── message-dedupe.ts     #   - Message deduplication logic
│   │
│   ├── types/                    # 📦 Global Type Definitions
│   └── hooks/                    # Custom React Hooks
│
├── scripts/                      # 🔧 Development Scripts
│   └── dev-reload.ts             #   - Manual build + auto-reload server
│
├── .output/                      # Build artifacts (do not edit)
├── wxt.config.ts                 # WXT Configuration
├── tailwind.config.js            # Tailwind Configuration
└── ...
```

### 📍 Where to Look (Task Map)

| Task                               | File Path / Directory                                                    |
| ---------------------------------- | ------------------------------------------------------------------------ |
| **Add support for new AI**         | `src/utils/platform-adapters/` (Create new adapter)                      |
| **Fix message parsing**            | `src/utils/platform-adapters/{platform}.ts`                              |
| **Modify database schema**         | `src/utils/db/index.ts`                                                  |
| **Update UI state**                | `src/utils/atoms/`                                                       |
| **Change network interception**    | `src/entrypoints/interceptor.content/index.ts`                           |
| **Update extension permissions**   | `wxt.config.ts`                                                          |
| **Adjust UI styles / theming**     | `src/assets/styles/globals.css` or `tailwind.config.js`                  |
| **Modify theme behavior**          | `src/utils/atoms/theme.ts`, `src/components/providers/ThemeProvider.tsx` |
| **Update search functionality**    | `src/utils/db/index.ts` (search), `src/utils/atoms/conversations.ts`     |
| **Modify sync behavior**           | `src/utils/sync/`                                                        |
| **Update conversation manager UI** | `src/components/ConversationsManager.tsx`                                |
| **Change popup UI**                | `src/entrypoints/popup/App.tsx`                                          |
| **Change manage page UI**          | `src/entrypoints/manage/App.tsx`                                         |
| **Modify dev workflow**            | `scripts/dev-reload.ts`, `src/entrypoints/background/index.ts`           |

---

## 9. Important Files

- `wxt.config.ts`: WXT and Manifest configuration.
- `src/types/index.ts`: Centralized types (Conversation, Message, Platform, Search types).
- `src/utils/platform-adapters/types.ts`: Interface for all platform adapters.
- `src/utils/db/index.ts`: Database definition and search functionality.
- `src/entrypoints/background/index.ts`: Main background logic and dev reload connection.
- `src/utils/atoms/conversations.ts`: Conversation state, search atoms, and actions.
- `src/utils/atoms/theme.ts`: Theme state management (light/dark/system).
- `src/components/providers/ThemeProvider.tsx`: Theme context provider.
- `src/assets/styles/globals.css`: CSS variables for theming.
- `scripts/dev-reload.ts`: Development reload server.

---

## 10. Troubleshooting

- **Build Errors**: Clear `.output` and `.wxt` folders. Run `pnpm install`.
- **HMR Issues**: Reload the extension in `chrome://extensions`, or use `pnpm dev:reload` for manual control.
- **Type Errors**: Run `pnpm type-check` to identify issues.
- **Interception Issues**: Check `interceptor.content` logs in the console (Page context).
- **Theme Not Applying**: Check `ThemeProvider` is wrapping the app, verify CSS variables in `globals.css`.
- **Search Not Working**: Check `searchConversationsWithMatches` in `db/index.ts`, verify atoms in `conversations.ts`.
- **Dev Reload Not Connecting**: Ensure `pnpm dev:reload` is running, check WebSocket connection on port 3717.

---

## 11. Completed Features

Recently implemented features:

| Feature              | Description                                                            | Related Files                                                         |
| -------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------- |
| **Batch Export**     | Select multiple conversations and export as ZIP (JSON) or Markdown     | `src/utils/sync/export.ts`, `src/components/ConversationsManager.tsx` |
| **Import/Export**    | Full import/export with ZIP format, checksums, and conflict resolution | `src/utils/sync/import.ts`, `src/utils/sync/export.ts`                |
| **Tags**             | Add/remove tags to conversations, filter by tags                       | `src/components/TagManager.tsx`, `src/utils/atoms/conversations.ts`   |
| **Full-text Search** | Search conversations and messages with highlighting                    | `src/utils/db/search.ts`, `src/components/HighlightText.tsx`          |

---

## 12. Future Roadmap

Potential features and improvements for future development:

### 🔴 High Priority

| Feature              | Description                             | Related Files           |
| -------------------- | --------------------------------------- | ----------------------- |
| **Chrome Web Store** | Prepare and publish to Chrome Web Store | `wxt.config.ts`, assets |

### 🟡 Medium Priority

| Feature             | Description                                 | Related Files                                       |
| ------------------- | ------------------------------------------- | --------------------------------------------------- |
| **Cloud Sync**      | Google Drive / iCloud / WebDAV sync support | `src/utils/sync/providers/`                         |
| **Advanced Search** | Date range filter, advanced search syntax   | `src/utils/db/`, `src/utils/atoms/conversations.ts` |
| **Markdown Import** | Import conversations from .md files         | `src/utils/sync/import.ts`                          |

### 🟢 Low Priority

| Feature                   | Description                                   | Related Files                             |
| ------------------------- | --------------------------------------------- | ----------------------------------------- |
| **Firefox Support**       | Full Firefox compatibility                    | `wxt.config.ts`, manifest                 |
| **Test Coverage**         | Increase unit test and E2E test coverage      | `src/**/*.test.ts`                        |
| **Keyboard Shortcuts**    | Implement all shortcuts mentioned in Settings | `src/components/`, `src/hooks/`           |
| **Batch Delete/Favorite** | Extend batch operations beyond export         | `src/components/ConversationsManager.tsx` |

### 📝 Implementation Notes

- **Cloud Sync**: Provider interface defined in `src/utils/sync/providers/`. Implement specific providers.
- **Advanced Search**: Consider adding date range picker UI and search syntax parser.

---
