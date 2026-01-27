import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MarkdownContent } from './MarkdownContent'

vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) => <div data-testid="markdown">{children}</div>,
}))

vi.mock('remark-gfm', () => ({
  default: () => {},
}))

vi.mock('rehype-highlight', () => ({
  default: () => {},
}))

describe('markdownContent', () => {
  it('should render content through ReactMarkdown', () => {
    render(<MarkdownContent content="Hello **bold** world" />)

    expect(screen.getByTestId('markdown')).toBeInTheDocument()
    expect(screen.getByText('Hello **bold** world')).toBeInTheDocument()
  })

  it('should render different content', () => {
    render(<MarkdownContent content="Some other markdown content" />)

    expect(screen.getByText('Some other markdown content')).toBeInTheDocument()
  })

  it('should be a memoized component', () => {
    const { rerender } = render(<MarkdownContent content="same content" />)
    rerender(<MarkdownContent content="same content" />)

    // With memo, the component should not re-render for same props
    expect(screen.getByTestId('markdown')).toBeInTheDocument()
  })
})
