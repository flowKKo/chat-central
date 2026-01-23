import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ConversationListItem } from './ConversationListItem'
import type { Conversation } from '@/types'

// Mock wxt/browser
vi.mock('wxt/browser', () => ({
  browser: {
    tabs: {
      create: vi.fn(),
    },
  },
}))

describe('ConversationListItem', () => {
  const createConversation = (overrides: Partial<Conversation> = {}): Conversation => ({
    id: 'claude_123',
    platform: 'claude',
    originalId: '123',
    title: 'Test Conversation',
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    messageCount: 5,
    preview: 'Test preview',
    tags: [],
    syncedAt: 1700000000000,
    detailStatus: 'full',
    detailSyncedAt: 1700000000000,
    isFavorite: false,
    favoriteAt: null,
    url: 'https://claude.ai/chat/123',
    ...overrides,
  })

  const defaultProps = {
    isSelected: false,
    onClick: vi.fn(),
    onToggleFavorite: vi.fn(),
  }

  it('should render conversation title', () => {
    const conversation = createConversation({ title: 'My Test Chat' })
    render(<ConversationListItem conversation={conversation} {...defaultProps} />)

    expect(screen.getByText('My Test Chat')).toBeInTheDocument()
  })

  it('should render platform name', () => {
    const conversation = createConversation({ platform: 'claude' })
    render(<ConversationListItem conversation={conversation} {...defaultProps} />)

    expect(screen.getByText('Claude')).toBeInTheDocument()
  })

  it('should call onClick when clicked', () => {
    const onClick = vi.fn()
    const conversation = createConversation()
    render(<ConversationListItem conversation={conversation} {...defaultProps} onClick={onClick} />)

    fireEvent.click(screen.getByRole('listitem'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('should call onClick when Enter key is pressed', () => {
    const onClick = vi.fn()
    const conversation = createConversation()
    render(<ConversationListItem conversation={conversation} {...defaultProps} onClick={onClick} />)

    fireEvent.keyDown(screen.getByRole('listitem'), { key: 'Enter' })
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('should call onToggleFavorite when favorite button is clicked', () => {
    const onToggleFavorite = vi.fn()
    const conversation = createConversation()
    render(
      <ConversationListItem
        conversation={conversation}
        {...defaultProps}
        onToggleFavorite={onToggleFavorite}
      />
    )

    const favoriteButton = screen.getByRole('button', { name: /add to favorites/i })
    fireEvent.click(favoriteButton)
    expect(onToggleFavorite).toHaveBeenCalledTimes(1)
  })

  it('should show "Remove from favorites" label when favorite', () => {
    const conversation = createConversation({ isFavorite: true })
    render(<ConversationListItem conversation={conversation} {...defaultProps} />)

    expect(screen.getByRole('button', { name: /remove from favorites/i })).toBeInTheDocument()
  })

  it('should have selected indicator when isSelected is true', () => {
    const conversation = createConversation()
    const { container } = render(
      <ConversationListItem conversation={conversation} {...defaultProps} isSelected={true} />
    )

    // Check for selected state class
    const listItem = container.querySelector('[role="listitem"]')
    expect(listItem).toHaveClass('bg-primary/10')
  })

  it('should highlight search query in title', () => {
    const conversation = createConversation({ title: 'Hello World Chat' })
    render(
      <ConversationListItem
        conversation={conversation}
        {...defaultProps}
        searchQuery="World"
      />
    )

    expect(screen.getByText(/World/i)).toBeInTheDocument()
  })
})
