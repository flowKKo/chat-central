<div align="center"><a name="readme-top"></a>

[![Chat Central](docs/images/banner.png)](https://www.chatcentral.cc)

Unified AI conversation manager: automatically capture, search, tag, and export your AI conversations.

**English** · [简体中文](README.zh-CN.md) · [Official Website](https://www.chatcentral.cc) · [Tutorial](https://www.chatcentral.cc/tutorial) · [Privacy](https://www.chatcentral.cc/privacy)

[![][license-shield]][license-link]
[![][website-shield]][website-link]
[![][platforms-shield]][website-link]
[![][stars-shield]][stars-link]
[![][issues-shield]][issues-link]

</div>

## Features

### Capture & Search

- **Auto Capture** — Your conversations are saved automatically as you chat, no manual effort needed
- **Multi-Platform** — Works with Claude, ChatGPT, and Gemini in one place
- **Full-text Search** — Find any conversation by title, content, or message text with result highlighting
- **Advanced Search** — Filter with `platform:claude`, `tag:work`, `before:2025-01`, `is:favorite`, and more

### Organize

- **Tags** — Add custom tags to categorize your conversations
- **Favorites** — Star important conversations for quick access
- **Filters** — Filter by date range, platform, or tags

### Export & Sync

- **Export** — Export single or multiple conversations as Markdown, JSON, or ZIP
- **Import** — Import conversations from ZIP with automatic conflict resolution
- **Cloud Sync** — Sync to Google Drive with automatic background sync

### Interface

- **Quick Access Popup** — Browse and search conversations right from the extension icon
- **Full Dashboard** — Manage all conversations with detail view, Markdown rendering, and batch actions
- **AI Summary** — Collapsible AI-generated summary for each conversation
- **Themes** — Light, dark, and system modes with platform-specific accent colors

## Installation

### Chrome Web Store

Coming soon.

### Manual Install

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

## Privacy

- All data stored locally on your device — nothing leaves unless you enable cloud sync
- Cloud sync uses a private Google Drive folder not visible in your Drive
- No analytics, no telemetry, no tracking
- No data sent to any third-party server
- Fully open source

## Contributing

Contributions are welcome! Feel free to open an [issue](https://github.com/flowKKo/chat-central/issues) or submit a pull request.

```bash
pnpm install         # Install dependencies
pnpm dev             # Dev server with HMR
pnpm validate        # Type-check + lint + test (run before submitting)
```

See `CLAUDE.md` for architecture details.

## License

[GPL-3.0](LICENSE)

<!-- LINK GROUP -->

[license-shield]: https://img.shields.io/badge/license-GPL--3.0-blue?style=flat-square&labelColor=black
[license-link]: ./LICENSE
[website-shield]: https://img.shields.io/badge/Website-chatcentral.cc-blue?style=flat-square&labelColor=black
[website-link]: https://www.chatcentral.cc
[platforms-shield]: https://img.shields.io/badge/platforms-Claude%20%7C%20ChatGPT%20%7C%20Gemini-purple?style=flat-square&labelColor=black
[stars-shield]: https://img.shields.io/github/stars/nicepkg/chat-central?style=flat-square&label=stars&color=yellow&labelColor=black
[stars-link]: https://github.com/nicepkg/chat-central/stargazers
[issues-shield]: https://img.shields.io/github/issues/nicepkg/chat-central?style=flat-square&labelColor=black
[issues-link]: https://github.com/nicepkg/chat-central/issues
