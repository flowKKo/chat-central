# Chat Central

Unified AI conversation manager - Track, search, and export your Claude, ChatGPT, and Gemini conversations.

## Features

- **Auto Sync** - Automatically captures conversations as you chat
- **Multi-Platform** - Supports Claude, ChatGPT, and Gemini
- **Smart Search** - Full-text search across all conversations with highlighting
- **Local Storage** - All data stays on your device (IndexedDB)
- **Theme Support** - Light, dark, and system modes
- **Export** - Export to Markdown or JSON
- **Favorites** - Mark important conversations for quick access

## Installation

### Chrome Web Store

Coming soon.

### Manual Installation

1. Download the latest release from [Releases](https://github.com/flowKKo/chat-central/releases)
2. Unzip the file
3. Open `chrome://extensions/` in Chrome
4. Enable "Developer mode"
5. Click "Load unpacked" and select the unzipped folder

## Usage

1. Install the extension
2. Visit [Claude](https://claude.ai), [ChatGPT](https://chatgpt.com), or [Gemini](https://gemini.google.com)
3. Start chatting - conversations are automatically synced
4. Click the extension icon to search and browse your conversations

## How It Works

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  AI Platform    │────▶│  API Interceptor │────▶│  Local Database │
│ (Claude/GPT/    │     │  (content script)│     │   (IndexedDB)   │
│  Gemini)        │     └──────────────────┘     └─────────────────┘
└─────────────────┘                                       │
                                                          ▼
                                              ┌─────────────────────┐
                                              │   Extension Popup   │
                                              │  (Search & Browse)  │
                                              └─────────────────────┘
```

1. **Intercept** - Captures API responses when you view conversations
2. **Normalize** - Platform adapters convert data to unified format
3. **Store** - Saves to local IndexedDB
4. **Access** - Search and browse via extension popup

## Privacy

- All data stored locally on your device
- No external servers or analytics
- Only reads conversations you actively view
- Open source - audit the code yourself

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

## License

MIT
