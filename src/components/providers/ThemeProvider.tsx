import { useEffect } from 'react'
import { useAtom } from 'jotai'
import {
  themePreferenceAtom,
  resolvedThemeAtom,
  initializeTheme,
  setupSystemThemeListener,
  applyThemeToDocument,
  type ResolvedTheme,
} from '@/utils/atoms/theme'

interface ThemeProviderProps {
  children: React.ReactNode
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [preference] = useAtom(themePreferenceAtom)
  const [, setResolved] = useAtom(resolvedThemeAtom)

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
  }, [preference, setResolved])

  return <>{children}</>
}
