import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'wxt'

// Load .env into process.env (no external dependencies)
const envPath = resolve(process.cwd(), '.env')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const match = line.match(/^([^#=\s]+)\s*=(.*)$/)
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].trim().replace(/^(['"])(.*)\1$/, '$2')
    }
  }
}

const googleClientId = process.env.GOOGLE_CLIENT_ID

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

    permissions: [
      'storage',
      'unlimitedStorage',
      'tabs',
      'contextMenus',
      'alarms',
      ...(googleClientId ? ['identity' as const] : []),
    ],

    // OAuth2 — only included when GOOGLE_CLIENT_ID is set in .env
    ...(googleClientId && {
      oauth2: {
        client_id: googleClientId,
        scopes: ['https://www.googleapis.com/auth/drive.appdata'],
      },
    }),

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
