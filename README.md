<div align="center"><a name="readme-top"></a>

[![Chat Central](docs/images/banner.png)](https://www.chatcentral.cc)

One place for all your AI conversations.

Auto-capture, search, tag, and export your Claude, ChatGPT & Gemini conversations — all stored locally in your browser.

**English** · [简体中文](README.zh-CN.md) · [Official Website](https://www.chatcentral.cc) · [Tutorial](https://www.chatcentral.cc/tutorial) · [Privacy](https://www.chatcentral.cc/privacy)

[![][license-shield]][license-link]
[![][website-shield]][website-link]
[![][platforms-shield]][website-link]

</div>

## Features

- **Auto Capture** — No manual saving, it just works
- **Instant Search** — Full-text search across every conversation
- **Tags & Favorites** — Your system, your rules
- **Export** — Markdown, JSON, or ZIP
- **Dashboard** — Detail view, batch actions, Markdown rendering
- **Private by Design** — All data stays in your browser. Zero tracking.

## Coming Soon

- **Cloud Sync** — Google Drive sync with automatic background sync
- **Knowledge Graph** — Link topics and ideas across conversations
- **AI Memory** — Resurface past insights when relevant
- **Semantic Search** — Search by meaning, not just keywords
- **Smart Notes** — Auto-generated summaries organized by topic

## Installation

### Chrome Web Store

[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/mkkjdicijdpjgbbbfldonopfjaflllad?style=flat-square)](https://chromewebstore.google.com/detail/chat-central/mkkjdicijdpjgbbbfldonopfjaflllad)

[**Install from Chrome Web Store**](https://chromewebstore.google.com/detail/chat-central/mkkjdicijdpjgbbbfldonopfjaflllad)

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

- All data stored locally on your device — nothing is sent to any server
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
