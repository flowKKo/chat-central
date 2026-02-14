/**
 * Shared theme detection and application for content script Shadow DOM hosts.
 * Used by widget and spotlight content scripts to keep dark mode in sync
 * with the host page.
 */
export function applyThemeToHost(host: HTMLElement): void {
  // Detect theme from page context
  const isDark =
    document.documentElement.classList.contains('dark') ||
    document.body.classList.contains('dark') ||
    window.matchMedia('(prefers-color-scheme: dark)').matches

  if (isDark) {
    host.classList.add('dark')
  }

  // Watch for system theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    host.classList.toggle('dark', e.matches)
  })

  // Watch for page class changes (Claude/ChatGPT toggle dark mode via class)
  const observer = new MutationObserver(() => {
    const dark =
      document.documentElement.classList.contains('dark') ||
      document.body.classList.contains('dark')
    host.classList.toggle('dark', dark)
  })

  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  observer.observe(document.body, { attributes: true, attributeFilter: ['class'] })
}
