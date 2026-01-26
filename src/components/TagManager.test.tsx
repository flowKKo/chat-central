import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TagManager } from './TagManager'

// Mock wxt/browser
vi.mock('wxt/browser', () => ({
  browser: {
    runtime: {
      sendMessage: vi.fn(),
    },
  },
}))

describe('tagManager', () => {
  const defaultProps = {
    tags: [],
    onTagsChange: vi.fn(),
    allTags: ['work', 'personal', 'important', 'archive'],
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('tag display', () => {
    it('should render existing tags as pills', () => {
      render(<TagManager {...defaultProps} tags={['work', 'personal']} />)

      expect(screen.getByText('work')).toBeInTheDocument()
      expect(screen.getByText('personal')).toBeInTheDocument()
    })

    it('should render add button when not read-only', () => {
      render(<TagManager {...defaultProps} />)

      expect(screen.getByRole('button', { name: /add tag/i })).toBeInTheDocument()
    })

    it('should not render add button when read-only', () => {
      render(<TagManager {...defaultProps} readOnly />)

      expect(screen.queryByRole('button', { name: /add tag/i })).not.toBeInTheDocument()
    })

    it('should not render anything when read-only and no tags', () => {
      const { container } = render(<TagManager {...defaultProps} tags={[]} readOnly />)

      expect(container.firstChild).toBeNull()
    })

    it('should show overflow indicator when maxDisplay is set', () => {
      render(<TagManager {...defaultProps} tags={['a', 'b', 'c', 'd', 'e']} maxDisplay={3} />)

      expect(screen.getByText('a')).toBeInTheDocument()
      expect(screen.getByText('b')).toBeInTheDocument()
      expect(screen.getByText('c')).toBeInTheDocument()
      expect(screen.queryByText('d')).not.toBeInTheDocument()
      expect(screen.getByText('+2')).toBeInTheDocument()
    })

    it('should apply compact styles when compact prop is true', () => {
      const { container } = render(<TagManager {...defaultProps} tags={['work']} compact />)

      const pill = container.querySelector('span')
      expect(pill).toHaveClass('text-[10px]')
    })
  })

  describe('tag removal', () => {
    it('should call onTagsChange when remove button is clicked', () => {
      const onTagsChange = vi.fn()
      render(
        <TagManager {...defaultProps} tags={['work', 'personal']} onTagsChange={onTagsChange} />,
      )

      const removeButton = screen.getByRole('button', { name: /remove tag work/i })
      fireEvent.click(removeButton)

      expect(onTagsChange).toHaveBeenCalledWith(['personal'])
    })

    it('should not show remove button in read-only mode', () => {
      render(<TagManager {...defaultProps} tags={['work']} readOnly />)

      expect(screen.queryByRole('button', { name: /remove tag/i })).not.toBeInTheDocument()
    })
  })

  describe('tag input', () => {
    it('should show input when add button is clicked', () => {
      render(<TagManager {...defaultProps} />)

      fireEvent.click(screen.getByRole('button', { name: /add tag/i }))

      expect(screen.getByPlaceholderText('Add tag...')).toBeInTheDocument()
    })

    it('should show autocomplete suggestions when typing', async () => {
      render(<TagManager {...defaultProps} />)

      fireEvent.click(screen.getByRole('button', { name: /add tag/i }))
      const input = screen.getByPlaceholderText('Add tag...')
      fireEvent.change(input, { target: { value: 'wor' } })

      await waitFor(() => {
        expect(screen.getByText('work')).toBeInTheDocument()
      })
    })

    it('should show create option for new tags', async () => {
      render(<TagManager {...defaultProps} />)

      fireEvent.click(screen.getByRole('button', { name: /add tag/i }))
      const input = screen.getByPlaceholderText('Add tag...')
      fireEvent.change(input, { target: { value: 'newtag' } })

      await waitFor(() => {
        expect(screen.getByText(/create "newtag"/i)).toBeInTheDocument()
      })
    })

    it('should call onTagsChange when selecting a suggestion', async () => {
      const onTagsChange = vi.fn()
      render(<TagManager {...defaultProps} onTagsChange={onTagsChange} />)

      fireEvent.click(screen.getByRole('button', { name: /add tag/i }))
      const input = screen.getByPlaceholderText('Add tag...')
      fireEvent.change(input, { target: { value: 'wor' } })

      await waitFor(() => {
        const option = screen.getByText('work')
        fireEvent.click(option)
      })

      expect(onTagsChange).toHaveBeenCalledWith(['work'])
    })

    it('should call onTagsChange when pressing Enter on new tag', async () => {
      const onTagsChange = vi.fn()
      render(<TagManager {...defaultProps} onTagsChange={onTagsChange} />)

      fireEvent.click(screen.getByRole('button', { name: /add tag/i }))
      const input = screen.getByPlaceholderText('Add tag...')
      fireEvent.change(input, { target: { value: 'newtag' } })
      fireEvent.keyDown(input, { key: 'Enter' })

      expect(onTagsChange).toHaveBeenCalledWith(['newtag'])
    })

    it('should close input when Escape is pressed', async () => {
      render(<TagManager {...defaultProps} />)

      fireEvent.click(screen.getByRole('button', { name: /add tag/i }))
      const input = screen.getByPlaceholderText('Add tag...')
      fireEvent.keyDown(input, { key: 'Escape' })

      await waitFor(() => {
        expect(screen.queryByPlaceholderText('Add tag...')).not.toBeInTheDocument()
      })
    })

    it('should not add duplicate tags', async () => {
      const onTagsChange = vi.fn()
      render(<TagManager {...defaultProps} tags={['work']} onTagsChange={onTagsChange} />)

      fireEvent.click(screen.getByRole('button', { name: /add tag/i }))
      const input = screen.getByPlaceholderText('Add tag...')
      fireEvent.change(input, { target: { value: 'work' } })
      fireEvent.keyDown(input, { key: 'Enter' })

      expect(onTagsChange).not.toHaveBeenCalled()
    })

    it('should filter out already added tags from suggestions', async () => {
      render(<TagManager {...defaultProps} tags={['work']} />)

      fireEvent.click(screen.getByRole('button', { name: /add tag/i }))
      const input = screen.getByPlaceholderText('Add tag...')
      fireEvent.change(input, { target: { value: 'wor' } })

      await waitFor(() => {
        // 'work' should not appear in suggestions since it's already added
        const suggestions = screen.queryAllByRole('option')
        const workOption = suggestions.find(
          (s) => s.textContent?.includes('work') && !s.textContent?.includes('Create'),
        )
        expect(workOption).toBeUndefined()
      })
    })

    it('should navigate suggestions with arrow keys', async () => {
      render(<TagManager {...defaultProps} />)

      fireEvent.click(screen.getByRole('button', { name: /add tag/i }))
      const input = screen.getByPlaceholderText('Add tag...')
      fireEvent.change(input, { target: { value: 'p' } })

      // Wait for suggestions to appear
      await waitFor(() => {
        expect(screen.getByText('personal')).toBeInTheDocument()
      })

      // Navigate with arrow down
      fireEvent.keyDown(input, { key: 'ArrowDown' })
      fireEvent.keyDown(input, { key: 'ArrowDown' })

      // Navigate back up
      fireEvent.keyDown(input, { key: 'ArrowUp' })
    })
  })
})
