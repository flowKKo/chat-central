import type { Conversation, Message } from '@/types'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ConversationDetail } from './ConversationDetail'

// Hoist mock functions so they are accessible inside vi.mock factories
const { mockScrollToMessageId, mockLoadAllTags, mockUpdateTags, mockRefreshDetail, mockAtoms } =
  vi.hoisted(() => {
    const atoms = {
      allTagsAtom: Symbol('allTagsAtom'),
      loadAllTagsAtom: Symbol('loadAllTagsAtom'),
      refreshConversationDetailAtom: Symbol('refreshConversationDetailAtom'),
      scrollToMessageIdAtom: Symbol('scrollToMessageIdAtom'),
      updateTagsAtom: Symbol('updateTagsAtom'),
    }
    return {
      mockScrollToMessageId: vi.fn(),
      mockLoadAllTags: vi.fn(),
      mockUpdateTags: vi.fn(),
      mockRefreshDetail: vi.fn(),
      mockAtoms: atoms,
    }
  })

// Mock wxt/browser
vi.mock('wxt/browser', () => ({
  browser: {
    tabs: {
      create: vi.fn(),
    },
    runtime: {
      onMessage: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
    },
  },
}))

// Mock jotai - useAtom returns [value, setter] based on which atom is passed
vi.mock('jotai', () => ({
  useAtom: vi.fn((atom: unknown) => {
    if (atom === mockAtoms.scrollToMessageIdAtom) {
      return [null, mockScrollToMessageId]
    }
    if (atom === mockAtoms.allTagsAtom) {
      return [['work', 'personal'], vi.fn()]
    }
    if (atom === mockAtoms.loadAllTagsAtom) {
      return [null, mockLoadAllTags]
    }
    if (atom === mockAtoms.updateTagsAtom) {
      return [null, mockUpdateTags]
    }
    if (atom === mockAtoms.refreshConversationDetailAtom) {
      return [null, mockRefreshDetail]
    }
    return [null, vi.fn()]
  }),
}))

// Mock atoms module with stable references
vi.mock('@/utils/atoms', () => mockAtoms)

// Mock export functions
vi.mock('@/utils/sync/export', () => ({
  exportToMarkdown: vi.fn().mockResolvedValue({ content: '# Test', filename: 'test.md' }),
  exportConversationToJson: vi.fn().mockResolvedValue({ content: '{}', filename: 'test.json' }),
}))

vi.mock('@/utils/sync/utils', () => ({
  downloadBlob: vi.fn(),
}))

// Mock child components to simplify rendering
vi.mock('../TagManager', () => ({
  TagManager: ({ tags }: { tags: string[] }) => (
    <div data-testid="tag-manager">
      {tags.map((tag: string) => (
        <span key={tag}>{tag}</span>
      ))}
    </div>
  ),
}))

vi.mock('./MessageBubble', () => ({
  MessageBubble: ({ message, searchQuery }: { message: Message; searchQuery?: string }) => (
    <div data-testid={`message-${message.id}`} data-message-id={message.id}>
      <span>{message.role === 'user' ? 'You' : 'Assistant'}</span>
      <span>{message.content}</span>
      {searchQuery && <span data-testid="search-highlight">{searchQuery}</span>}
    </div>
  ),
}))

vi.mock('./SummaryBlock', () => ({
  SummaryBlock: ({ summary }: { summary: string }) => (
    <div data-testid="summary-block">{summary}</div>
  ),
}))

function createConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
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
  }
}

function createMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'msg-1',
    conversationId: 'claude_123',
    role: 'user',
    content: 'Hello there',
    createdAt: 1700000000000,
    ...overrides,
  }
}

describe('conversationDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render conversation title', () => {
    const conversation = createConversation({ title: 'My Chat About AI' })
    render(<ConversationDetail conversation={conversation} messages={[]} />)

    expect(screen.getByText('My Chat About AI')).toBeInTheDocument()
  })

  it('should render platform name', () => {
    const conversation = createConversation({ platform: 'claude' })
    render(<ConversationDetail conversation={conversation} messages={[]} />)

    expect(screen.getByText('Claude')).toBeInTheDocument()
  })

  it('should render message count', () => {
    const messages = [
      createMessage({ id: 'msg-1', role: 'user', content: 'Hello' }),
      createMessage({ id: 'msg-2', role: 'assistant', content: 'Hi there' }),
      createMessage({ id: 'msg-3', role: 'user', content: 'How are you?' }),
    ]
    render(<ConversationDetail conversation={createConversation()} messages={messages} />)

    expect(screen.getByText('3 messages')).toBeInTheDocument()
  })

  it('should render messages', () => {
    const messages = [
      createMessage({ id: 'msg-1', role: 'user', content: 'Hello' }),
      createMessage({ id: 'msg-2', role: 'assistant', content: 'Hi there' }),
    ]
    render(<ConversationDetail conversation={createConversation()} messages={messages} />)

    expect(screen.getByTestId('message-msg-1')).toBeInTheDocument()
    expect(screen.getByTestId('message-msg-2')).toBeInTheDocument()
    expect(screen.getByText('Hello')).toBeInTheDocument()
    expect(screen.getByText('Hi there')).toBeInTheDocument()
  })

  it('should show empty state when no messages', () => {
    render(
      <ConversationDetail
        conversation={createConversation({ detailStatus: 'full' })}
        messages={[]}
      />
    )

    expect(screen.getByText('No synced messages yet')).toBeInTheDocument()
  })

  it('should show summary block when summary exists', () => {
    const conversation = createConversation({
      summary: 'This conversation is about AI topics',
    })
    render(<ConversationDetail conversation={conversation} messages={[]} />)

    expect(screen.getByTestId('summary-block')).toBeInTheDocument()
    expect(screen.getByText('This conversation is about AI topics')).toBeInTheDocument()
  })

  it('should not show summary block when no summary', () => {
    const conversation = createConversation({ summary: undefined })
    render(<ConversationDetail conversation={conversation} messages={[]} />)

    expect(screen.queryByTestId('summary-block')).not.toBeInTheDocument()
  })

  it('should pass searchQuery to message bubbles', () => {
    const messages = [createMessage({ id: 'msg-1', role: 'user', content: 'Hello world' })]
    render(
      <ConversationDetail
        conversation={createConversation()}
        messages={messages}
        searchQuery="world"
      />
    )

    expect(screen.getByTestId('search-highlight')).toBeInTheDocument()
    expect(screen.getByTestId('search-highlight')).toHaveTextContent('world')
  })

  it('should show sync warning when detailStatus is not full', () => {
    const conversation = createConversation({ detailStatus: 'none' })
    render(<ConversationDetail conversation={conversation} messages={[]} />)

    expect(
      screen.getByText('Open the original conversation to sync full content')
    ).toBeInTheDocument()
    expect(screen.getByText('Open')).toBeInTheDocument()
  })

  it('should show sync warning when messages are empty even with full detail status', () => {
    const conversation = createConversation({ detailStatus: 'full' })
    render(<ConversationDetail conversation={conversation} messages={[]} />)

    expect(
      screen.getByText('Open the original conversation to sync full content')
    ).toBeInTheDocument()
  })

  it('should not show sync warning when fully synced with messages', () => {
    const messages = [createMessage({ id: 'msg-1', role: 'user', content: 'Hello' })]
    const conversation = createConversation({ detailStatus: 'full' })
    render(<ConversationDetail conversation={conversation} messages={messages} />)

    expect(
      screen.queryByText('Open the original conversation to sync full content')
    ).not.toBeInTheDocument()
  })

  it('should render export options button', () => {
    render(<ConversationDetail conversation={createConversation()} messages={[]} />)

    expect(screen.getByLabelText('Export options')).toBeInTheDocument()
  })

  it('should toggle export menu when export button clicked', () => {
    render(<ConversationDetail conversation={createConversation()} messages={[]} />)

    const exportButton = screen.getByLabelText('Export options')
    fireEvent.click(exportButton)

    expect(screen.getByText('Export as Markdown')).toBeInTheDocument()
    expect(screen.getByText('Export as JSON')).toBeInTheDocument()
  })

  it('should call loadAllTags on mount', () => {
    render(<ConversationDetail conversation={createConversation()} messages={[]} />)

    expect(mockLoadAllTags).toHaveBeenCalled()
  })

  it('should render tag manager with conversation tags', () => {
    const conversation = createConversation({ tags: ['work', 'ai'] })
    render(<ConversationDetail conversation={conversation} messages={[]} />)

    expect(screen.getByTestId('tag-manager')).toBeInTheDocument()
    expect(screen.getByText('work')).toBeInTheDocument()
    expect(screen.getByText('ai')).toBeInTheDocument()
  })

  it('should hide summary block when searching and summary does not contain query', () => {
    const conversation = createConversation({
      summary: 'This conversation is about AI topics',
    })
    render(
      <ConversationDetail conversation={conversation} messages={[]} searchQuery="algorithms" />
    )

    expect(screen.queryByTestId('summary-block')).not.toBeInTheDocument()
  })

  it('should show summary block when searching and summary contains query', () => {
    const conversation = createConversation({
      summary: 'This conversation is about AI topics',
    })
    render(<ConversationDetail conversation={conversation} messages={[]} searchQuery="AI" />)

    expect(screen.getByTestId('summary-block')).toBeInTheDocument()
    expect(screen.getByText('This conversation is about AI topics')).toBeInTheDocument()
  })

  it('should show summary block when not searching', () => {
    const conversation = createConversation({
      summary: 'This conversation is about AI topics',
    })
    render(<ConversationDetail conversation={conversation} messages={[]} />)

    expect(screen.getByTestId('summary-block')).toBeInTheDocument()
  })

  it('should render open in platform button', () => {
    render(<ConversationDetail conversation={createConversation()} messages={[]} />)

    expect(screen.getByLabelText('Open in platform')).toBeInTheDocument()
  })

  it('should display formatted update time', () => {
    const conversation = createConversation({ updatedAt: 1700000000000 })
    render(<ConversationDetail conversation={conversation} messages={[]} />)

    const expectedDate = new Date(1700000000000).toLocaleString()
    expect(screen.getByText(expectedDate)).toBeInTheDocument()
  })
})
