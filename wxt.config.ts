import { defineConfig } from 'wxt'

export default defineConfig({
  srcDir: 'src',
  imports: false, // Manually manage imports
  manifestVersion: 3,
  modules: ['@wxt-dev/module-react'],

  manifest: ({ mode, browser }) => ({
    name: 'Chat Central',
    description:
      'Unified AI conversation manager - Track, search, and export your Claude, ChatGPT, and Gemini conversations',
    version: '0.1.0',

    // Chrome/Edge fixed dev ID (development environment)
    ...(mode === 'development' &&
      (browser === 'chrome' || browser === 'edge') &&
      {
        // Can generate fixed dev key later
      }),

    permissions: ['storage', 'unlimitedStorage', 'tabs', 'contextMenus', 'identity', 'alarms'],

    // OAuth2 configuration for Google Drive cloud sync
    // NOTE: Replace with your own client ID from Google Cloud Console
    // 1. Create a project at https://console.cloud.google.com/
    // 2. Enable Google Drive API
    // 3. Create OAuth 2.0 credentials (Chrome extension type)
    // 4. Set the client ID below
    oauth2: {
      client_id: 'YOUR_CLIENT_ID.apps.googleusercontent.com',
      scopes: ['https://www.googleapis.com/auth/drive.appdata'],
    },

    // Extension key for consistent extension ID during development
    // Generate with: openssl rand -base64 32 | head -c 32
    // key: 'YOUR_EXTENSION_KEY',

    host_permissions: [
      'https://claude.ai/*',
      'https://chat.openai.com/*',
      'https://chatgpt.com/*',
      'https://gemini.google.com/*',
    ],

    // Firefox specific configuration
    ...(browser === 'firefox' && {
      browser_specific_settings: {
        gecko: {
          id: 'chat-central@extension',
          strict_min_version: '109.0',
        },
      },
    }),
  }),

  // Disable auto-open browser, manually load extension in logged-in Chrome
  runner: {
    disabled: true,
  },

  dev: {
    server: {
      port: 3000,
    },
  },

  vite: () => ({
    resolve: {
      alias: {
        '@': '/src',
      },
    },
  }),
})
