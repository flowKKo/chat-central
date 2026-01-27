import type { Message } from '@/types'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MessageBubble } from './MessageBubble'

vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) => <div data-testid="markdown">{children}</div>,
}))

vi.mock('remark-gfm', () => ({
  default: () => {},
}))

vi.mock('rehype-highlight', () => ({
  default: () => {},
}))

describe('messageBubble', () => {
  const createMessage = (overrides: Partial<Message> = {}): Message => ({
    id: 'msg_1',
    conversationId: 'conv_1',
    role: 'user',
    content: 'Hello, world!',
    createdAt: 1700000000000,
    ...overrides,
  })

  it('should render user message with markdown', () => {
    const message = createMessage({ role: 'user', content: 'Hello from user' })
    render(<MessageBubble message={message} platformColor="#0ea5e9" />)

    expect(screen.getByText('You')).toBeInTheDocument()
    expect(screen.getByText('Hello from user')).toBeInTheDocument()
    expect(screen.getByTestId('markdown')).toBeInTheDocument()
  })

  it('should render assistant message with markdown', () => {
    const message = createMessage({ role: 'assistant', content: 'Hello from assistant' })
    render(<MessageBubble message={message} platformColor="#0ea5e9" />)

    expect(screen.getByText('Assistant')).toBeInTheDocument()
    expect(screen.getByText('Hello from assistant')).toBeInTheDocument()
    expect(screen.getByTestId('markdown')).toBeInTheDocument()
  })

  it('should have data-message-id attribute', () => {
    const message = createMessage({ id: 'test-msg-123' })
    const { container } = render(<MessageBubble message={message} platformColor="#0ea5e9" />)

    const element = container.querySelector('[data-message-id="test-msg-123"]')
    expect(element).toBeInTheDocument()
  })

  it('should use HighlightText when searchQuery is provided', () => {
    const message = createMessage({ content: 'Hello world test' })
    render(<MessageBubble message={message} platformColor="#0ea5e9" searchQuery="world" />)

    expect(screen.getByText(/world/i)).toBeInTheDocument()
    expect(screen.queryByTestId('markdown')).not.toBeInTheDocument()
  })

  it('should display message time', () => {
    const message = createMessage({ createdAt: 1700000000000 })
    render(<MessageBubble message={message} platformColor="#0ea5e9" />)

    const timeElement = screen.getByText(/\d{1,2}:\d{2}/)
    expect(timeElement).toBeInTheDocument()
  })
})
