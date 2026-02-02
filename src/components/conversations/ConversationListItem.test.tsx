import type { Conversation } from '@/types'
import type { SearchResultWithMatches } from '@/utils/db'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ConversationListItem } from './ConversationListItem'

// Mock wxt/browser
vi.mock('wxt/browser', () => ({
  browser: {
    tabs: {
      create: vi.fn(),
    },
  },
}))

describe('conversationListItem', () => {
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
      <ConversationListItem conversation={conversation} {...defaultProps} isSelected />
    )

    // Check for selected state class
    const listItem = container.querySelector('[role="listitem"]')
    expect(listItem).toHaveClass('bg-primary/10')
  })

  it('should highlight search query in title', () => {
    const conversation = createConversation({ title: 'Hello World Chat' })
    render(
      <ConversationListItem conversation={conversation} {...defaultProps} searchQuery="World" />
    )

    expect(screen.getByText(/World/i)).toBeInTheDocument()
  })

  describe('search result display priority', () => {
    it('should show message match snippet in muted box when message match exists', () => {
      const conversation = createConversation({
        summary: 'A summary about coding',
        preview: 'Some preview text',
      })
      const matchInfo: SearchResultWithMatches = {
        conversation,
        matches: [{ type: 'message', text: 'matched message content', messageId: 'msg-1' }],
      }
      const { container } = render(
        <ConversationListItem
          conversation={conversation}
          {...defaultProps}
          searchQuery="matched"
          matchInfo={matchInfo}
        />
      )

      // Message match should be shown in a rounded muted box
      const matchBox = container.querySelector('.rounded-md.bg-muted\\/50')
      expect(matchBox).toBeInTheDocument()
      expect(screen.getByText(/matched/i)).toBeInTheDocument()

      // Summary and preview should NOT be shown
      expect(screen.queryByText('A summary about coding')).not.toBeInTheDocument()
      expect(screen.queryByText('Some preview text')).not.toBeInTheDocument()
    })

    it('should show highlighted summary when summary matches query and no message match', () => {
      const conversation = createConversation({
        summary: 'A summary about coding patterns',
        preview: 'Some preview text',
      })
      render(
        <ConversationListItem conversation={conversation} {...defaultProps} searchQuery="coding" />
      )

      // Summary should be shown with highlight
      expect(screen.getByText(/coding/i)).toBeInTheDocument()
      // Preview should NOT be shown
      expect(screen.queryByText('Some preview text')).not.toBeInTheDocument()
    })

    it('should show highlighted preview when only title/preview matches (not summary)', () => {
      const conversation = createConversation({
        summary: 'Unrelated summary text',
        preview: 'Preview about algorithms',
      })
      render(
        <ConversationListItem
          conversation={conversation}
          {...defaultProps}
          searchQuery="algorithms"
        />
      )

      // Preview should be shown highlighted
      expect(screen.getByText(/algorithms/i)).toBeInTheDocument()
      // Summary should NOT be shown
      expect(screen.queryByText('Unrelated summary text')).not.toBeInTheDocument()
    })

    it('should show summary or preview without highlight when not searching', () => {
      const conversation = createConversation({
        summary: 'A nice summary',
        preview: 'Some preview',
      })
      render(<ConversationListItem conversation={conversation} {...defaultProps} />)

      // Summary should be shown (takes priority over preview)
      expect(screen.getByText('A nice summary')).toBeInTheDocument()
    })

    it('should show preview when no summary and not searching', () => {
      const conversation = createConversation({
        summary: undefined,
        preview: 'Fallback preview text',
      })
      render(<ConversationListItem conversation={conversation} {...defaultProps} />)

      expect(screen.getByText('Fallback preview text')).toBeInTheDocument()
    })

    it('should show nothing when searching and no preview available', () => {
      const conversation = createConversation({
        title: 'Match title here',
        summary: undefined,
        preview: '',
      })
      const { container } = render(
        <ConversationListItem conversation={conversation} {...defaultProps} searchQuery="Match" />
      )

      // No snippet section should be rendered (only title highlight)
      const snippetElements = container.querySelectorAll('.line-clamp-2')
      expect(snippetElements).toHaveLength(0)
    })
  })
})
