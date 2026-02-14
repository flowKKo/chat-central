import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

interface SpotlightInputProps {
  query: string
  onQueryChange: (q: string) => void
  isLoading: boolean
  isVisible: boolean
}

export function SpotlightInput({
  query,
  onQueryChange,
  isLoading,
  isVisible,
}: SpotlightInputProps) {
  const { t } = useTranslation('spotlight')
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-focus when visible
  useEffect(() => {
    if (isVisible) {
      // Small delay to ensure DOM is ready after animation
      requestAnimationFrame(() => {
        inputRef.current?.focus()
      })
    }
  }, [isVisible])

  return (
    <div className="spotlight-input-wrapper">
      {/* Search icon */}
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ color: 'hsl(var(--muted-foreground))', flexShrink: 0 }}
      >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </svg>

      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder={t('searchPlaceholder')}
        spellCheck={false}
        autoComplete="off"
      />

      {isLoading && <div className="spotlight-spinner" />}

      {!isLoading && query && (
        <button
          type="button"
          onClick={() => onQueryChange('')}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'hsl(var(--muted-foreground))',
            padding: '2px',
            display: 'flex',
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      )}
    </div>
  )
}
