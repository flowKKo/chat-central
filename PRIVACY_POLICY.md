# Privacy Policy

**Effective Date:** February 4, 2026

## What Chat Central Does

Chat Central automatically captures AI conversations from Claude, ChatGPT, and Gemini as you chat. All data is stored locally in your browser. The extension provides search, tagging, favorites, export, and optional Google Drive cloud sync.

## Data Collection

Chat Central captures **AI conversation content** (your prompts and AI responses) from supported platforms by reading API responses your browser already receives. It does not make any additional network requests to these platforms.

Captured data includes:

- **Conversation metadata** — Titles, timestamps, platform, message counts, preview text
- **Conversation content** — Full message text (your prompts and AI responses)
- **User-created data** — Tags, favorites, organizational labels
- **Preferences** — Theme, language, widget, and sync settings

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

The extension also uses `chrome.storage` to persist small configuration values (theme, sync settings).

## Cloud Sync (Optional)

Google Drive sync is entirely opt-in and disabled by default.

When you enable it:

- OAuth 2.0 authentication via `chrome.identity` — the extension never sees your Google password
- Data is stored in a **private app folder** (`drive.appdata`) that only Chat Central can access, not visible in your Drive
- Sync occurs only when you manually trigger it or explicitly enable auto-sync
- You can disconnect at any time via [Google Account permissions](https://myaccount.google.com/permissions)

No data is sent to any server owned by Chat Central developers.

## Permissions

| Permission           | Purpose                                                                                                                                               |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **storage**          | Persist user preferences (theme, language, widget settings) and sync state across browser sessions, shared between popup, dashboard, and widget       |
| **unlimitedStorage** | Store large conversation databases locally in IndexedDB without hitting browser quota limits                                                          |
| **tabs**             | Open URLs in new tabs when you click a conversation, navigate to the dashboard, or click platform links from the popup — only on explicit user action |
| **contextMenus**     | Add a right-click "Add to Favorites" / "Remove from Favorites" menu on AI chat pages (claude.ai, chatgpt.com, gemini.google.com)                      |
| **alarms**           | Power optional automatic cloud sync at user-configured intervals — only active when cloud sync is explicitly enabled, no alarms set by default        |
| **identity**         | OAuth2 authentication with Google Drive when you enable cloud sync, scoped to `drive.appdata` only — never triggered unless you explicitly connect    |
| **Host permissions** | Run content scripts on claude.ai, chatgpt.com, chat.openai.com, and gemini.google.com to capture conversation data from API responses                 |

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

The only external service is **Google Drive** (optional), governed by [Google's Privacy Policy](https://policies.google.com/privacy). The extension contains no advertising, analytics, tracking, or third-party SDKs.

## Data Deletion

- **Delete individual conversations** from the extension interface
- **Clear all data** or **clear by platform** from settings
- **Uninstall** the extension to remove all local data
- **Revoke cloud sync** via [Google Account permissions](https://myaccount.google.com/permissions)

## Data Security

- Local data is protected by your browser's built-in sandboxing
- Google Drive sync communicates over HTTPS
- OAuth tokens are managed by `chrome.identity`, not stored by the extension
- Source code is publicly auditable

## Children's Privacy

Chat Central does not knowingly collect data from children under 13. The extension is intended for users with existing AI platform accounts.

## Changes to This Policy

Updates will be reflected by changing the effective date. Significant changes will be noted in GitHub release notes. The full change history is available in the Git repository.

## Open Source & Contact

Chat Central is open source under [GPL-3.0](LICENSE). Review the source code and report concerns at [github.com/nicepkg/chat-central](https://github.com/nicepkg/chat-central/issues).
