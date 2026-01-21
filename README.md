# Chat Central

Unified AI conversation manager - Track, search, and export your Claude, ChatGPT, and Gemini conversations.

## Features

- **Auto Sync**: Automatically captures conversations as you chat on Claude, ChatGPT, and Gemini
- **Smart Search**: Full-text search across all your conversations
- **Local Storage**: All data stays on your device using IndexedDB
- **Export**: Export conversations to Markdown or JSON

## Development

### Prerequisites

- Node.js 18+
- pnpm 9+

### Setup

```bash
# Install dependencies
pnpm install

# Start development server (Chrome)
pnpm dev

# Start development server (Firefox)
pnpm dev:firefox
```

### Build

```bash
# Build for Chrome
pnpm build

# Build for Firefox
pnpm build:firefox

# Create ZIP for distribution
pnpm zip
pnpm zip:firefox
```

## Project Structure

```
src/
├── entrypoints/           # Browser extension entry points
│   ├── background/        # Service worker
│   ├── popup/            # Popup UI
│   ├── options/          # Options page
│   ├── interceptor.content/  # API interceptor (runs in page context)
│   └── observer.content/     # Message relay (runs in extension context)
│
├── components/           # React components
├── hooks/               # Custom React hooks
├── utils/
│   ├── atoms/           # Jotai state atoms
│   ├── db/              # IndexedDB operations
│   ├── platform-adapters/  # Platform-specific parsers
│   └── constants/       # App constants
│
├── types/               # TypeScript types
└── assets/              # Static assets
```

## How It Works

1. **API Interception**: When you use Claude/ChatGPT/Gemini, the extension intercepts API responses containing conversation data
2. **Data Normalization**: Platform-specific adapters parse the data into a unified format
3. **Local Storage**: Conversations are stored in IndexedDB
4. **Search & Browse**: Use the popup or options page to search and browse your conversations

## Privacy

- All data is stored locally on your device
- No data is sent to external servers
- The extension only reads data from conversations you actively view
