import type { Message } from '@/types'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { MessageBubble } from './MessageBubble'

describe('messageBubble', () => {
  const createMessage = (overrides: Partial<Message> = {}): Message => ({
    id: 'msg_1',
    conversationId: 'conv_1',
    role: 'user',
    content: 'Hello, world!',
    createdAt: 1700000000000,
    ...overrides,
  })

  it('should render user message', () => {
    const message = createMessage({ role: 'user', content: 'Hello from user' })
    render(<MessageBubble message={message} platformColor="#0ea5e9" />)

    expect(screen.getByText('You')).toBeInTheDocument()
    expect(screen.getByText('Hello from user')).toBeInTheDocument()
  })

  it('should render assistant message', () => {
    const message = createMessage({ role: 'assistant', content: 'Hello from assistant' })
    render(<MessageBubble message={message} platformColor="#0ea5e9" />)

    expect(screen.getByText('Assistant')).toBeInTheDocument()
    expect(screen.getByText('Hello from assistant')).toBeInTheDocument()
  })

  it('should have data-message-id attribute', () => {
    const message = createMessage({ id: 'test-msg-123' })
    const { container } = render(<MessageBubble message={message} platformColor="#0ea5e9" />)

    const element = container.querySelector('[data-message-id="test-msg-123"]')
    expect(element).toBeInTheDocument()
  })

  it('should highlight search query when provided', () => {
    const message = createMessage({ content: 'Hello world test' })
    render(<MessageBubble message={message} platformColor="#0ea5e9" searchQuery="world" />)

    // HighlightText should render with the query
    expect(screen.getByText(/world/i)).toBeInTheDocument()
  })

  it('should display message time', () => {
    const message = createMessage({ createdAt: 1700000000000 })
    render(<MessageBubble message={message} platformColor="#0ea5e9" />)

    // Time should be displayed (format depends on locale)
    const timeElement = screen.getByText(/\d{1,2}:\d{2}/)
    expect(timeElement).toBeInTheDocument()
  })
})
