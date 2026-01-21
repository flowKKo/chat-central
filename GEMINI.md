# GEMINI.md - AI Assistant Guide for Chat Central

<!--
This file is generated from AI_GUIDE.template.md.
Do not edit directly; update the template and run `bun run generate:ai-guides`.
-->

> **Last Updated**: 2026-01-21
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
    *   What is the core data? Who owns it? (IndexedDB via Dexie)
    *   Can we redesign data structures to eliminate branches/complexity?
2.  **Eliminate Special Cases**: "Good code has no special cases."
    *   Identify `if/else` branches that patch bad design.
    *   Refactor to make the "special case" the normal case (e.g., use Platform Adapters).
3.  **Destructive Analysis**:
    *   List all existing features that might be affected.
    *   Ensure zero destructiveness to user data (especially local IndexedDB).

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
    *   *Tool*: `read_file`
2.  **WRITE**: Apply atomic changes. Use sufficient context for `replace`.
    *   *Tool*: `write_file` or `replace`
3.  **VERIFY**: Check the file content **after** editing to ensure the change was applied correctly and didn't break syntax.
    *   *Tool*: `read_file` or `run_shell_command` (grep/cat)

### 🚨 Critical Safety Checks
- **Never** modify `.output` or `.wxt` folders directly.
- **Never** commit `.env` or secrets.
- **Always** run `pnpm type-check` after modifying TypeScript definitions.
- **Always** run `pnpm lint` before finishing.

---

## 4. Module Glossary & Complexity Hotspots

| Module (Path) | Responsibility | Complexity | Notes |
|---------------|----------------|------------|-------|
| `utils/platform-adapters/` | **Core Logic** for parsing AI responses. | 🌶️ High | Handles different API schemas (Claude/GPT/Gemini). Critical for sync. |
| `entrypoints/interceptor.content` | Network request interception. | 🌶️ High | Injects into page context (MAIN world). Fragile to site updates. |
| `utils/db/` | **Single Source of Truth** (IndexedDB). | 🟡 Medium | Wrapper around Dexie.js. Handles persistence. |
| `entrypoints/background` | Central coordinator. | 🟡 Medium | Handles messages, triggers DB updates. |
| `utils/atoms/` | Global State (Jotai). | 🟢 Low | React state management. |
| `entrypoints/popup` | Extension Popup UI. | 🟢 Low | Main user interface. |

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
# Start Dev Server
pnpm dev

# Start Dev Server (Firefox)
pnpm dev:firefox
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
│   ├── components/               # React Components
│   │   ├── ui/                   #   - Generic UI (Button, Input)
│   │   ├── shadcn/               #   - Shadcn UI components
│   │   └── providers/            #   - Context Providers
│   │
│   ├── entrypoints/              # 🚪 WXT ENTRY POINTS
│   │   ├── background/           #   - Service Worker (Coordinator)
│   │   ├── interceptor.content/  #   - Network Interceptor (Page Context)
│   │   ├── observer.content/     #   - DOM Observer (Content Script)
│   │   ├── popup/                #   - Main Extension UI
│   │   └── options/              #   - Settings Page
│   │
│   ├── utils/                    # 🧠 CORE LOGIC
│   │   ├── platform-adapters/    #   - Platform-specific parsing logic (Crucial)
│   │   ├── db/                   #   - IndexedDB (Dexie) wrapper
│   │   ├── atoms/                #   - Jotai State Definitions
│   │   └── constants/            #   - Global constants
│   │
│   ├── types/                    # 📦 Global Type Definitions
│   └── hooks/                    # Custom React Hooks
│
├── .output/                      # Build artifacts (do not edit)
├── wxt.config.ts                 # WXT Configuration
├── tailwind.config.js            # Tailwind Configuration
└── ...
```

### 📍 Where to Look (Task Map)

| Task | File Path / Directory |
|------|-----------------------|
| **Add support for new AI** | `src/utils/platform-adapters/` (Create new adapter) |
| **Fix message parsing** | `src/utils/platform-adapters/{platform}.ts` |
| **Modify database schema** | `src/utils/db/index.ts` |
| **Update UI state** | `src/utils/atoms/` |
| **Change network interception** | `src/entrypoints/interceptor.content/index.ts` |
| **Update extension permissions** | `wxt.config.ts` |
| **Adjust UI styles** | `src/assets/styles/globals.css` or `tailwind.config.js` |

---

## 9. Important Files

- `wxt.config.ts`: WXT and Manifest configuration.
- `src/types/index.ts`: Centralized types (Conversation, Message, Platform).
- `src/utils/platform-adapters/types.ts`: Interface for all platform adapters.
- `src/utils/db/index.ts`: Database definition.
- `src/entrypoints/background/index.ts`: Main background logic.

---

## 10. Troubleshooting

- **Build Errors**: Clear `.output` and `.wxt` folders. Run `pnpm install`.
- **HMR Issues**: Reload the extension in `chrome://extensions`.
- **Type Errors**: Run `pnpm type-check` to identify issues.
- **Interception Issues**: Check `interceptor.content` logs in the console (Page context).

---
