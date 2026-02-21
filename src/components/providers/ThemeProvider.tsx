import { useAtom } from 'jotai'
import { useEffect } from 'react'
import {
  applyThemeToDocument,
  initializeTheme,
  type ResolvedTheme,
  setupSystemThemeListener,
  themePreferenceAtom,
} from '@/utils/atoms/theme'

interface ThemeProviderProps {
  children: React.ReactNode
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [preference] = useAtom(themePreferenceAtom)

  // Initialize theme on mount
  useEffect(() => {
    initializeTheme()
  }, [])

  // Listen for system theme changes
  useEffect(() => {
    const cleanup = setupSystemThemeListener((newTheme: ResolvedTheme) => {
      // Update resolved theme when system preference changes
      // This is only called when preference is 'system'
      applyThemeToDocument(newTheme)
    })

    return cleanup
  }, [preference])

  return <>{children}</>
}
