import ReactDOM from 'react-dom/client'
import { storage } from 'wxt/storage'
import type { Config } from '@/types'
import { initLanguage } from '@/locales'
import { App } from './App'
import '@/assets/styles/globals.css'
import '../spotlight.content/styles/spotlight.css'
import './styles.css'

async function applyTheme() {
  try {
    const config = await storage.getItem<Config>('local:config')
    const theme = config?.ui?.theme ?? 'system'
    const prefersDark =
      theme === 'dark' ||
      (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
    document.documentElement.classList.toggle('dark', prefersDark)
  } catch {
    // Fallback to system preference
    document.documentElement.classList.toggle(
      'dark',
      window.matchMedia('(prefers-color-scheme: dark)').matches
    )
  }
}

async function init() {
  await initLanguage()
  await applyTheme()

  ReactDOM.createRoot(document.getElementById('root')!).render(<App />)
}

init()
