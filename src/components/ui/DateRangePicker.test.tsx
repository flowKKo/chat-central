import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DateRangePicker } from './DateRangePicker'
import { daysAgo, parseDateString } from '@/utils/date'

describe('dateRangePicker', () => {
  const mockOnChange = vi.fn()

  beforeEach(() => {
    mockOnChange.mockClear()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-06-15T12:00:00'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('rendering', () => {
    it('should render preset buttons', () => {
      render(<DateRangePicker startDate={null} endDate={null} onChange={mockOnChange} />)

      expect(screen.getByText('Today')).toBeInTheDocument()
      expect(screen.getByText('Last 7 days')).toBeInTheDocument()
      expect(screen.getByText('Last 30 days')).toBeInTheDocument()
      expect(screen.getByText('Last 90 days')).toBeInTheDocument()
    })

    it('should render date inputs', () => {
      render(<DateRangePicker startDate={null} endDate={null} onChange={mockOnChange} />)

      expect(screen.getByLabelText('Start date')).toBeInTheDocument()
      expect(screen.getByLabelText('End date')).toBeInTheDocument()
    })

    it('should not show clear button when no dates selected', () => {
      render(<DateRangePicker startDate={null} endDate={null} onChange={mockOnChange} />)

      expect(screen.queryByText('Clear date filter')).not.toBeInTheDocument()
    })

    it('should show clear button when dates are selected', () => {
      const startDate = new Date('2024-06-01').getTime()
      const endDate = new Date('2024-06-15').getTime()
      render(<DateRangePicker startDate={startDate} endDate={endDate} onChange={mockOnChange} />)

      expect(screen.getByText('Clear date filter')).toBeInTheDocument()
    })

    it('should apply custom className', () => {
      const { container } = render(
        <DateRangePicker
          startDate={null}
          endDate={null}
          onChange={mockOnChange}
          className="custom-class"
        />
      )

      expect(container.querySelector('.custom-class')).toBeInTheDocument()
    })
  })

  describe('preset selection', () => {
    it('should call onChange with today range when Today clicked', () => {
      render(<DateRangePicker startDate={null} endDate={null} onChange={mockOnChange} />)

      fireEvent.click(screen.getByText('Today'))

      expect(mockOnChange).toHaveBeenCalledTimes(1)
      const call = mockOnChange.mock.calls[0]![0] as { start: number; end: number }
      // Start should be start of today
      expect(call.start).toBe(new Date('2024-06-15T00:00:00').getTime())
      // End should be now
      expect(call.end).toBe(Date.now())
    })

    it('should call onChange with 7 day range when Last 7 days clicked', () => {
      render(<DateRangePicker startDate={null} endDate={null} onChange={mockOnChange} />)

      fireEvent.click(screen.getByText('Last 7 days'))

      expect(mockOnChange).toHaveBeenCalledTimes(1)
      const call = mockOnChange.mock.calls[0]![0] as { start: number; end: number }
      expect(call.start).toBe(daysAgo(7))
      expect(call.end).toBe(Date.now())
    })

    it('should call onChange with 30 day range when Last 30 days clicked', () => {
      render(<DateRangePicker startDate={null} endDate={null} onChange={mockOnChange} />)

      fireEvent.click(screen.getByText('Last 30 days'))

      expect(mockOnChange).toHaveBeenCalledTimes(1)
      const call = mockOnChange.mock.calls[0]![0] as { start: number | null; end: number | null }
      expect(call.start).toBe(daysAgo(30))
    })

    it('should call onChange with 90 day range when Last 90 days clicked', () => {
      render(<DateRangePicker startDate={null} endDate={null} onChange={mockOnChange} />)

      fireEvent.click(screen.getByText('Last 90 days'))

      expect(mockOnChange).toHaveBeenCalledTimes(1)
      const call = mockOnChange.mock.calls[0]![0] as { start: number | null; end: number | null }
      expect(call.start).toBe(daysAgo(90))
    })
  })

  describe('preset highlighting', () => {
    it('should highlight active preset', () => {
      const now = Date.now()
      const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000

      render(<DateRangePicker startDate={sevenDaysAgo} endDate={now} onChange={mockOnChange} />)

      const button = screen.getByText('Last 7 days')
      expect(button).toHaveClass('bg-primary/10')
    })

    it('should not highlight preset when dates do not match', () => {
      const customStart = new Date('2024-01-01').getTime()
      const customEnd = new Date('2024-01-15').getTime()

      render(
        <DateRangePicker startDate={customStart} endDate={customEnd} onChange={mockOnChange} />
      )

      const buttons = screen
        .getAllByRole('button')
        .filter((b) => b.textContent !== 'Clear date filter')
      buttons.forEach((button) => {
        expect(button).not.toHaveClass('bg-primary/10')
      })
    })
  })

  describe('custom date input', () => {
    it('should display formatted start date', () => {
      // Use parseDateString to ensure consistent local timezone
      const startDate = parseDateString('2024-06-01')!
      render(<DateRangePicker startDate={startDate} endDate={null} onChange={mockOnChange} />)

      const startInput = screen.getByLabelText('Start date') as HTMLInputElement
      expect(startInput.value).toBe('2024-06-01')
    })

    it('should display formatted end date', () => {
      const endDate = parseDateString('2024-06-15')!
      render(<DateRangePicker startDate={null} endDate={endDate} onChange={mockOnChange} />)

      const endInput = screen.getByLabelText('End date') as HTMLInputElement
      expect(endInput.value).toBe('2024-06-15')
    })

    it('should call onChange when start date changes', () => {
      render(<DateRangePicker startDate={null} endDate={null} onChange={mockOnChange} />)

      const startInput = screen.getByLabelText('Start date')
      fireEvent.change(startInput, { target: { value: '2024-06-01' } })

      expect(mockOnChange).toHaveBeenCalledTimes(1)
      const call = mockOnChange.mock.calls[0]![0] as { start: number | null; end: number | null }
      expect(call.start).toBe(parseDateString('2024-06-01'))
      expect(call.end).toBeNull()
    })

    it('should call onChange when end date changes', () => {
      const startDate = parseDateString('2024-06-01')!
      render(<DateRangePicker startDate={startDate} endDate={null} onChange={mockOnChange} />)

      const endInput = screen.getByLabelText('End date')
      fireEvent.change(endInput, { target: { value: '2024-06-15' } })

      expect(mockOnChange).toHaveBeenCalledTimes(1)
      const call = mockOnChange.mock.calls[0]![0] as { start: number | null; end: number | null }
      expect(call.start).toBe(startDate)
      expect(call.end).toBe(parseDateString('2024-06-15'))
    })
  })

  describe('clear functionality', () => {
    it('should call onChange with nulls when clear clicked', () => {
      const startDate = new Date('2024-06-01').getTime()
      const endDate = new Date('2024-06-15').getTime()
      render(<DateRangePicker startDate={startDate} endDate={endDate} onChange={mockOnChange} />)

      fireEvent.click(screen.getByText('Clear date filter'))

      expect(mockOnChange).toHaveBeenCalledWith({ start: null, end: null })
    })
  })
})
