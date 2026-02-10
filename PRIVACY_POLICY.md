# Privacy Policy

**Effective Date:** February 10, 2026

## What Chat Central Does

Chat Central automatically captures AI conversations from Claude, ChatGPT, and Gemini as you chat. All data is stored locally in your browser. The extension provides search, tagging, favorites, and export.

## Data Collection

Chat Central captures **AI conversation content** (your prompts and AI responses) from supported platforms by reading API responses your browser already receives. It does not make any additional network requests to these platforms.

Captured data includes:

- **Conversation metadata** — Titles, timestamps, platform, message counts, preview text
- **Conversation content** — Full message text (your prompts and AI responses)
- **User-created data** — Tags, favorites, organizational labels
- **Preferences** — Theme, language, and widget settings

**We do NOT collect:**

- Personal information (name, email, address, age)
- Health, financial, or authentication information
- Browser history or location data
- Keystroke, click, or mouse tracking data
- Analytics, telemetry, or usage statistics

## Data Storage

All data is stored **locally** in your browser using IndexedDB:

- Data resides entirely on your device
- Nothing is transmitted to any external server by default
- Data persists across browser sessions, tied to your browser profile
- Uninstalling the extension removes all locally stored data

The extension also uses `chrome.storage` to persist small configuration values (theme, language, widget settings).

## Permissions

| Permission           | Purpose                                                                                                                                      |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **storage**          | Persist user preferences (theme, language, widget settings) across browser sessions, shared between popup, dashboard, and widget             |
| **unlimitedStorage** | Store large conversation databases locally in IndexedDB without hitting browser quota limits                                                 |
| **tabs**             | Open URLs in new tabs when you click a conversation, navigate to the dashboard, or click platform links from the popup — only on user action |
| **contextMenus**     | Add a right-click "Add to Favorites" / "Remove from Favorites" menu on AI chat pages (claude.ai, chatgpt.com, gemini.google.com)             |
| **Host permissions** | Run content scripts on claude.ai, chatgpt.com, chat.openai.com, and gemini.google.com to capture conversation data from API responses        |

### Host Permissions Detail

Content scripts run **only** on these four AI chat domains:

1. **Interceptor** — Reads API responses containing conversation content as you chat (runs in page context)
2. **Observer** — Relays captured data to the background service worker (runs in extension context)
3. **Widget** — Optional floating UI for quick conversation access (runs in extension context)

These scripts do not access any other websites.

## Third-Party Data Sharing

- We do **not** sell or transfer user data to third parties
- We do **not** use or transfer user data for purposes unrelated to the extension
- We do **not** use or transfer user data to determine creditworthiness or for lending purposes

The extension makes no external network requests. It contains no advertising, analytics, tracking, or third-party SDKs.

## Data Deletion

- **Delete individual conversations** from the extension interface
- **Clear all data** or **clear by platform** from settings
- **Uninstall** the extension to remove all local data

## Data Security

- Local data is protected by your browser's built-in sandboxing
- No data leaves your device — the extension makes no external network requests
- Source code is publicly auditable

## Children's Privacy

Chat Central does not knowingly collect data from children under 13. The extension is intended for users with existing AI platform accounts.

## Changes to This Policy

Updates will be reflected by changing the effective date. Significant changes will be noted in GitHub release notes. The full change history is available in the Git repository.

## Open Source & Contact

Chat Central is open source under [GPL-3.0](LICENSE). Review the source code and report concerns at [github.com/nicepkg/chat-central](https://github.com/nicepkg/chat-central/issues).
