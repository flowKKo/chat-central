import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, beforeEach } from 'vitest'
import { SummaryBlock } from './SummaryBlock'

describe('summaryBlock', () => {
  const shortText = 'A short summary.'
  const longText = `${'A '.repeat(200)}very long summary that should be clamped.`

  describe('rendering', () => {
    it('should render the summary label', () => {
      render(<SummaryBlock summary={shortText} />)
      expect(screen.getByText('Summary')).toBeInTheDocument()
    })

    it('should render the summary text', () => {
      render(<SummaryBlock summary={shortText} />)
      expect(screen.getByText(shortText)).toBeInTheDocument()
    })

    it('should apply line-clamp-2 class by default', () => {
      render(<SummaryBlock summary={shortText} />)
      const paragraph = screen.getByText(shortText)
      expect(paragraph.className).toContain('line-clamp-2')
    })
  })

  describe('expand/collapse', () => {
    beforeEach(() => {
      // Mock scrollHeight > clientHeight to simulate clamped text
      Object.defineProperty(HTMLParagraphElement.prototype, 'scrollHeight', {
        configurable: true,
        get: () => 200,
      })
      Object.defineProperty(HTMLParagraphElement.prototype, 'clientHeight', {
        configurable: true,
        get: () => 40,
      })
    })

    it('should show expand button when text is clamped', () => {
      render(<SummaryBlock summary={longText} />)
      expect(screen.getByText('Show more')).toBeInTheDocument()
    })

    it('should have aria-expanded=false initially', () => {
      render(<SummaryBlock summary={longText} />)
      const button = screen.getByText('Show more').closest('button')
      expect(button).toHaveAttribute('aria-expanded', 'false')
    })

    it('should toggle text and aria-expanded on click', () => {
      render(<SummaryBlock summary={longText} />)
      const button = screen.getByText('Show more').closest('button')!

      fireEvent.click(button)
      expect(screen.getByText('Show less')).toBeInTheDocument()
      expect(button).toHaveAttribute('aria-expanded', 'true')

      fireEvent.click(button)
      expect(screen.getByText('Show more')).toBeInTheDocument()
      expect(button).toHaveAttribute('aria-expanded', 'false')
    })

    it('should remove line-clamp-2 when expanded', () => {
      render(<SummaryBlock summary={longText} />)
      const paragraph = screen.getByText(longText)
      expect(paragraph.className).toContain('line-clamp-2')

      fireEvent.click(screen.getByText('Show more'))
      expect(paragraph.className).not.toContain('line-clamp-2')
    })
  })
})
