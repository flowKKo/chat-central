import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Provider as JotaiProvider, useSetAtom } from 'jotai'
import React, { useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { configAtom, hydrateConfig } from '@/utils/atoms/config'
import App from './App'
import '@/assets/styles/globals.css'

const queryClient = new QueryClient()

function ConfigHydrator({ children }: { children: React.ReactNode }) {
  const setConfig = useSetAtom(configAtom)

  useEffect(() => {
    const unwatch = hydrateConfig(setConfig)
    return unwatch
  }, [setConfig])

  return children
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <JotaiProvider>
          <ConfigHydrator>
            <App />
          </ConfigHydrator>
        </JotaiProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>
)
