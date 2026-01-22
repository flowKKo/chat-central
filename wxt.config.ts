import { defineConfig } from 'wxt'

export default defineConfig({
  srcDir: 'src',
  imports: false, // Manually manage imports
  manifestVersion: 3,
  modules: ['@wxt-dev/module-react'],

  manifest: ({ mode, browser }) => ({
    name: 'Chat Central',
    description: 'Unified AI conversation manager - Track, search, and export your Claude, ChatGPT, and Gemini conversations',
    version: '0.1.0',

    // Chrome/Edge fixed dev ID (development environment)
    ...(mode === 'development' &&
      (browser === 'chrome' || browser === 'edge') && {
        // Can generate fixed dev key later
      }),

    permissions: ['storage', 'unlimitedStorage', 'tabs', 'contextMenus'],

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
