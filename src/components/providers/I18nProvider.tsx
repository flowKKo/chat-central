import { useEffect } from 'react'
import { initLanguage } from '@/locales'

interface I18nProviderProps {
  children: React.ReactNode
}

export function I18nProvider({ children }: I18nProviderProps) {
  useEffect(() => {
    const cleanup = initLanguage()
    return cleanup
  }, [])

  return <>{children}</>
}
