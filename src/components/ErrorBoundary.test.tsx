import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ErrorBoundary } from './ErrorBoundary'

// Mock logger
vi.mock('@/utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

// Component that throws on render
function ThrowingComponent({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Test render error')
  }
  return <div>Normal content</div>
}

describe('errorBoundary', () => {
  beforeEach(() => {
    // Suppress React error boundary console output in tests
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('should render children when no error', () => {
    render(
      <ErrorBoundary>
        <div>Hello world</div>
      </ErrorBoundary>
    )

    expect(screen.getByText('Hello world')).toBeInTheDocument()
  })

  it('should render fallback UI when child throws', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow />
      </ErrorBoundary>
    )

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByText('Test render error')).toBeInTheDocument()
    expect(screen.getByText('Try again')).toBeInTheDocument()
  })

  it('should render custom fallback when provided', () => {
    render(
      <ErrorBoundary fallback={<div>Custom fallback</div>}>
        <ThrowingComponent shouldThrow />
      </ErrorBoundary>
    )

    expect(screen.getByText('Custom fallback')).toBeInTheDocument()
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument()
  })

  it('should recover when Try again is clicked', () => {
    let shouldThrow = true

    function ConditionalThrow() {
      if (shouldThrow) throw new Error('Error!')
      return <div>Recovered</div>
    }

    const { rerender } = render(
      <ErrorBoundary>
        <ConditionalThrow />
      </ErrorBoundary>
    )

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()

    // Fix the error and click retry
    shouldThrow = false
    fireEvent.click(screen.getByText('Try again'))

    // Re-render to trigger the recovered state
    rerender(
      <ErrorBoundary>
        <ConditionalThrow />
      </ErrorBoundary>
    )

    expect(screen.getByText('Recovered')).toBeInTheDocument()
  })
})
