[English](README.md) | [简体中文](README.zh-CN.md)

# Chat Central

Unified AI conversation manager — automatically capture, search, tag, and export your conversations across Claude, ChatGPT, and Gemini.

## Features

### Core

- **Auto Capture** — Intercepts API responses as you chat, no manual effort required
- **Multi-Platform** — Claude, ChatGPT, and Gemini with a unified adapter architecture
- **Full-text Search** — Search across titles, previews, summaries, and message content with result highlighting
- **Advanced Search Syntax** — `platform:claude`, `tag:work`, `before:2025-01`, `after:2024-06`, `is:favorite`
- **Local-first** — All data stored in IndexedDB on your device, no external servers

### Organization

- **Tags** — Add custom tags to conversations for categorization
- **Favorites** — Star important conversations for quick access
- **Date Range Filter** — Filter by date with built-in presets
- **Platform Filter** — View conversations by platform or all at once

### Export & Sync

- **Export** — Single conversation or batch export as Markdown, JSON, or ZIP (JSONL + manifest)
- **Import** — Import from ZIP with conflict resolution and checksums
- **Cloud Sync** — Google Drive sync via OAuth2 with auto-sync, retry, and conflict resolution
- **Sync Engine** — Pull/merge/push cycle with field-level merge strategies (LWW, union, max, min)

### UI

- **Extension Popup** — Compact conversation browser with search, platform tabs, and favorites
- **Dashboard** — Full-page manager with conversation detail, message rendering, and batch actions
- **Markdown Rendering** — Rich display in message bubbles (code blocks, links, lists, syntax highlighting)
- **AI Summary** — Collapsible summary block for conversations
- **Theme** — Light, dark, and system modes with platform-specific accent colors

## Supported Platforms

| Platform | List Sync | Detail Sync | Stream Capture |
| -------- | --------- | ----------- | -------------- |
| Claude   | Yes       | Yes         | Yes            |
| ChatGPT  | Yes       | Yes         | Yes            |
| Gemini   | Yes       | Yes         | —              |

## How It Works

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  AI Platform    │────▶│  API Interceptor  │────▶│  Background SW  │
│  (Claude/GPT/   │     │  (MAIN world CS)  │     │  (merge + store)│
│   Gemini)       │     └──────────────────┘     └────────┬────────┘
└─────────────────┘                                       │
                                                          ▼
                                              ┌─────────────────────┐
                                              │   IndexedDB (Dexie) │
                                              └────────┬────────────┘
                                                       │
                                         ┌─────────────┼─────────────┐
                                         ▼             ▼             ▼
                                   ┌──────────┐  ┌──────────┐  ┌──────────┐
                                   │  Popup   │  │Dashboard │  │  Cloud   │
                                   │  (quick  │  │  (full   │  │  Sync   │
                                   │  browse) │  │  manage) │  │ (GDrive)│
                                   └──────────┘  └──────────┘  └──────────┘
```

1. **Intercept** — Content script (MAIN world) captures API responses from AI platforms
2. **Normalize** — Platform adapters parse responses into a unified `Conversation` / `Message` format
3. **Merge & Store** — Background service worker merges data and persists to IndexedDB
4. **Access** — Browse via popup, manage in dashboard, sync to Google Drive

## Installation

### Chrome Web Store

Coming soon.

### Manual Installation

1. Download the latest release from [Releases](https://github.com/flowKKo/chat-central/releases)
2. Unzip the file
3. Open `chrome://extensions/`
4. Enable **Developer mode**
5. Click **Load unpacked** and select the unzipped folder

### Build from Source

```bash
git clone https://github.com/flowKKo/chat-central.git
cd chat-central
pnpm install
pnpm build          # Chrome
pnpm build:firefox  # Firefox
```

Output will be in `.output/`.

## Development

```bash
pnpm install         # Install dependencies
pnpm dev             # Dev server with HMR
pnpm dev:firefox     # Dev server for Firefox
pnpm dev:reload      # Manual build + auto reload (for testing with login state)

pnpm validate        # Type-check + lint + test
pnpm type-check      # TypeScript only
pnpm lint            # ESLint only
pnpm test            # Vitest (990+ tests)
```

## Tech Stack

| Category   | Technology                           |
| ---------- | ------------------------------------ |
| Extension  | WXT (Manifest V3)                    |
| UI         | React 19, Tailwind CSS, Lucide       |
| State      | Jotai                                |
| Database   | Dexie (IndexedDB)                    |
| Search     | MiniSearch                           |
| Cloud Sync | Google Drive (chrome.identity OAuth) |
| Validation | Zod                                  |
| Testing    | Vitest, Testing Library              |
| Language   | TypeScript (strict)                  |

## Privacy

- All data stored locally in IndexedDB — nothing leaves your device unless you enable cloud sync
- Cloud sync uses Google Drive's app-specific data folder (not visible in your Drive)
- No analytics, telemetry, or external tracking
- No data sent to any third-party server
- Open source — audit the code yourself

## Contributing

```bash
pnpm install
pnpm dev
```

See the codebase structure in `CLAUDE.md` for architecture details. Run `pnpm validate` before submitting changes.

## License

[GPL-3.0](LICENSE)
