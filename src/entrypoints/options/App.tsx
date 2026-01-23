import { useEffect } from 'react'
import { browser } from 'wxt/browser'

export default function App() {
  useEffect(() => {
    // Redirect to unified dashboard settings page
    window.location.href = browser.runtime.getURL('/manage.html#/settings')
  }, [])

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <p className="text-muted-foreground">Redirecting to settings...</p>
    </div>
  )
}
