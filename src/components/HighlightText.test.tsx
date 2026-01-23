import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HighlightText } from './HighlightText'

describe('highlightText', () => {
  describe('basic rendering', () => {
    it('should render text without query', () => {
      render(<HighlightText text="Hello world" query="" />)
      expect(screen.getByText('Hello world')).toBeInTheDocument()
    })

    it('should render text with whitespace-only query', () => {
      render(<HighlightText text="Hello world" query="   " />)
      expect(screen.getByText('Hello world')).toBeInTheDocument()
    })
  })

  describe('highlighting', () => {
    it('should highlight matching text', () => {
      render(<HighlightText text="Hello world" query="world" />)
      const highlight = screen.getByText('world')
      expect(highlight.tagName).toBe('MARK')
    })

    it('should highlight case-insensitively', () => {
      render(<HighlightText text="Hello WORLD" query="world" />)
      const highlight = screen.getByText('WORLD')
      expect(highlight.tagName).toBe('MARK')
    })

    it('should highlight multiple matches', () => {
      render(<HighlightText text="hello hello hello" query="hello" />)
      const highlights = screen.getAllByText('hello')
      expect(highlights).toHaveLength(3)
      highlights.forEach((h) => expect(h.tagName).toBe('MARK'))
    })

    it('should handle query at start of text', () => {
      const { container } = render(<HighlightText text="hello world" query="hello" />)
      const mark = container.querySelector('mark')
      expect(mark?.textContent).toBe('hello')
      const spans = container.querySelectorAll('span > span')
      expect(spans.length).toBe(1)
      expect(spans[0]!.textContent).toBe(' world')
    })

    it('should handle query at end of text', () => {
      const { container } = render(<HighlightText text="hello world" query="world" />)
      const mark = container.querySelector('mark')
      expect(mark?.textContent).toBe('world')
      const spans = container.querySelectorAll('span > span')
      expect(spans.length).toBe(1)
      expect(spans[0]!.textContent).toBe('hello ')
    })

    it('should handle query that spans entire text', () => {
      render(<HighlightText text="hello" query="hello" />)
      expect(screen.getByText('hello').tagName).toBe('MARK')
    })

    it('should not highlight when no match', () => {
      render(<HighlightText text="hello world" query="xyz" />)
      expect(screen.getByText('hello world').tagName).toBe('SPAN')
    })
  })

  describe('truncation', () => {
    it('should truncate long text without query', () => {
      const longText = 'This is a very long text that should be truncated'
      render(<HighlightText text={longText} query="" maxLength={20} />)
      expect(screen.getByText('This is a very lo...')).toBeInTheDocument()
    })

    it('should not truncate short text', () => {
      render(<HighlightText text="Short text" query="" maxLength={50} />)
      expect(screen.getByText('Short text')).toBeInTheDocument()
    })

    it('should center truncation around match', () => {
      const text = 'Start of text with the important keyword in the middle and more text at the end'
      render(<HighlightText text={text} query="keyword" maxLength={30} />)
      const highlight = screen.getByText('keyword')
      expect(highlight.tagName).toBe('MARK')
    })
  })

  describe('custom className', () => {
    it('should apply custom className to container', () => {
      const { container } = render(<HighlightText text="Hello" query="" className="custom-class" />)
      expect(container.querySelector('.custom-class')).toBeInTheDocument()
    })

    it('should apply custom highlight className', () => {
      render(
        <HighlightText text="Hello world" query="world" highlightClassName="custom-highlight" />
      )
      expect(screen.getByText('world')).toHaveClass('custom-highlight')
    })
  })

  describe('fadeEdges', () => {
    it('should render with fade edges when truncated', () => {
      const longText = 'This is a very long text with keyword somewhere in the middle of it all'
      const { container } = render(
        <HighlightText text={longText} query="keyword" maxLength={30} fadeEdges />
      )
      // With fadeEdges, it uses gradient spans instead of ellipsis
      expect(container.querySelector('.relative')).toBeInTheDocument()
    })
  })

  describe('edge cases', () => {
    it('should handle empty text', () => {
      const { container } = render(<HighlightText text="" query="test" />)
      expect(container.querySelector('span')).toBeInTheDocument()
    })

    it('should handle special regex characters in query', () => {
      // The component uses indexOf, not regex, so special chars should work
      render(<HighlightText text="Hello (world)" query="(world)" />)
      expect(screen.getByText('(world)').tagName).toBe('MARK')
    })

    it('should handle overlapping potential matches', () => {
      render(<HighlightText text="aaa" query="aa" />)
      // First 'aa' should be highlighted, then 'a' remains
      const highlights = screen.getAllByText('aa')
      expect(highlights).toHaveLength(1)
      expect(highlights[0]!.tagName).toBe('MARK')
    })
  })
})
