# Privacy Policy

**Chat Central Browser Extension**

**Effective Date**: February 2, 2026
**Version**: 1.0

---

## Overview

Chat Central is an open-source browser extension (licensed under GPL-3.0) that helps you manage, search, and export your AI conversations from Claude, ChatGPT, and Gemini. This privacy policy explains what data the extension handles, how it is stored, and what controls you have over it.

The core principle is simple: **your data stays on your device unless you explicitly choose otherwise**.

---

## 1. What Data Is Collected

Chat Central captures and stores the following data locally in your browser:

- **Conversation metadata**: Titles, timestamps, platform of origin (Claude, ChatGPT, or Gemini), message counts, and preview text.
- **Conversation content**: The full text of messages exchanged between you and the AI platforms, including both your prompts and the AI responses.
- **User-created data**: Tags, favorites, and any organizational labels you apply to conversations within the extension.
- **Application preferences**: Theme settings, sync configuration, and other extension preferences.

Chat Central captures this data by intercepting API responses between your browser and the supported AI platforms. The extension reads the responses that your browser already receives from these services. It does not make any additional network requests to these platforms on your behalf.

**Chat Central does NOT collect**:

- Personal identity information (name, email, address)
- Browser history or activity outside of the supported AI platforms
- Analytics, telemetry, or usage statistics
- Credentials or authentication tokens for any service

---

## 2. How Data Is Stored

All captured conversation data is stored **locally** in your browser using IndexedDB, a standard browser storage mechanism. This means:

- Your data resides entirely on your device.
- Your data is not transmitted to any external server by default.
- Your data persists across browser sessions and is tied to your browser profile.
- Uninstalling the extension will remove all locally stored data.

The extension also uses the browser's `chrome.storage` API to persist small configuration values such as theme preferences and sync settings.

---

## 3. Cloud Sync (Optional, User-Initiated)

Chat Central offers an **optional** cloud sync feature using Google Drive. This feature is entirely opt-in and does nothing unless you explicitly enable it and authorize the connection.

When you enable Google Drive sync:

- The extension uses OAuth 2.0 via the `chrome.identity` API to authenticate with your Google account. The extension never sees or stores your Google password.
- Data is stored in the **Google Drive Application Data folder**, a special folder that only the Chat Central extension can access. Other applications, including other Google Drive apps, cannot read this data.
- The OAuth scope requested is `https://www.googleapis.com/auth/drive.appdata`, which grants access only to the application-specific data folder, not to any other files in your Google Drive.
- Sync operations (upload and download) occur only when you initiate them manually or when you have explicitly enabled automatic sync.
- You can revoke the extension's access to your Google account at any time through your Google Account permissions page (https://myaccount.google.com/permissions).

No data is sent to any server owned or operated by Chat Central or its developers. The only external service involved is Google Drive, and only when you choose to use it.

---

## 4. Third-Party Services

Chat Central does not integrate with, send data to, or receive data from any third-party services, with the following exception:

- **Google Drive** (optional): Used exclusively for cloud sync when you enable it. Governed by Google's Privacy Policy (https://policies.google.com/privacy). The extension communicates with Google Drive's REST API only to read and write sync data in your application data folder.

Chat Central contains:

- No advertising
- No analytics or tracking scripts
- No telemetry
- No third-party SDKs that collect user data

---

## 5. Browser Permissions Explained

Chat Central requests the following browser permissions, each for a specific and necessary purpose:

| Permission                                                                                  | Purpose                                                                                                                                             |
| ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Host permissions** for `claude.ai`, `chatgpt.com`, `chat.openai.com`, `gemini.google.com` | Required to run content scripts on these sites that intercept AI conversation API responses. The extension only operates on these specific domains. |
| **storage**                                                                                 | Used to store extension preferences and configuration.                                                                                              |
| **unlimitedStorage**                                                                        | Allows IndexedDB to store conversation data beyond the default storage quota, necessary for users with large conversation histories.                |
| **tabs**                                                                                    | Used to detect when you navigate to a supported AI platform, so the extension can activate conversation capture on the correct pages.               |
| **contextMenus**                                                                            | Enables right-click menu options for quick actions on supported AI platform pages.                                                                  |
| **alarms**                                                                                  | Used to schedule periodic auto-sync operations when cloud sync is enabled.                                                                          |
| **identity** (conditional)                                                                  | Requested only when Google Drive sync is configured. Used to authenticate with your Google account via OAuth 2.0.                                   |

---

## 6. Data Deletion

You have full control over your data at all times:

- **Delete individual conversations**: You can remove specific conversations from within the extension interface.
- **Clear all data**: The extension settings include an option to delete all stored conversation data.
- **Clear platform data**: You can selectively delete all conversations from a specific platform (Claude, ChatGPT, or Gemini).
- **Uninstall the extension**: Removing the extension from your browser deletes all locally stored data, including the IndexedDB database and any stored preferences.
- **Revoke cloud sync access**: If you have enabled Google Drive sync, you can revoke access through your Google Account permissions page. Data already synced to Google Drive can be managed through Google Drive's storage management tools.

---

## 7. Data Security

- All data stored locally benefits from your browser's built-in security and sandboxing protections.
- Google Drive sync communication occurs over HTTPS.
- The extension does not store any authentication tokens persistently; OAuth tokens are managed by the browser's `chrome.identity` API.
- The source code is publicly available for inspection at https://github.com/flowKKo/chat-central.

---

## 8. Children's Privacy

Chat Central does not knowingly collect data from children under the age of 13. The extension is a productivity tool intended for users who already have accounts with the supported AI platforms.

---

## 9. Changes to This Policy

This privacy policy may be updated to reflect changes in the extension's functionality or to comply with applicable regulations. When changes are made:

- The "Effective Date" at the top of this document will be updated.
- Significant changes will be noted in the extension's release notes on GitHub.
- Continued use of the extension after changes are posted constitutes acceptance of the revised policy.

The full history of changes to this policy is available in the project's Git repository.

---

## 10. Contact

If you have questions, concerns, or requests regarding this privacy policy or the extension's data practices, please open an issue on the project's GitHub repository:

https://github.com/flowKKo/chat-central/issues

---

## 11. Open Source

Chat Central is free and open-source software, licensed under the GNU General Public License v3.0 (GPL-3.0). You can review the complete source code, including all data handling logic, at:

https://github.com/flowKKo/chat-central
