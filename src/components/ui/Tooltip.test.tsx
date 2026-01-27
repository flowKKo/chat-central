import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Tooltip } from './Tooltip'

describe('tooltip', () => {
  it('should render children', () => {
    render(
      <Tooltip label="Help text">
        <button type="button">Click me</button>
      </Tooltip>
    )
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument()
  })

  it('should render tooltip text with role="tooltip"', () => {
    render(
      <Tooltip label="Help text">
        <span>Trigger</span>
      </Tooltip>
    )
    expect(screen.getByRole('tooltip')).toHaveTextContent('Help text')
  })

  it('should link tooltip via aria-describedby', () => {
    render(
      <Tooltip label="Help text">
        <span>Trigger</span>
      </Tooltip>
    )
    const tooltip = screen.getByRole('tooltip')
    const wrapper = tooltip.parentElement!
    expect(tooltip).toHaveAttribute('id')
    expect(wrapper).toHaveAttribute('aria-describedby', tooltip.id)
  })

  it('should default to bottom position', () => {
    render(
      <Tooltip label="Help text">
        <span>Trigger</span>
      </Tooltip>
    )
    const tooltip = screen.getByRole('tooltip')
    expect(tooltip.className).toContain('top-full')
    expect(tooltip.className).toContain('mt-2')
  })

  it('should support top position', () => {
    render(
      <Tooltip label="Help text" position="top">
        <span>Trigger</span>
      </Tooltip>
    )
    const tooltip = screen.getByRole('tooltip')
    expect(tooltip.className).toContain('bottom-full')
    expect(tooltip.className).toContain('mb-2')
  })

  it('should apply custom className to wrapper', () => {
    render(
      <Tooltip label="Help text" className="custom-class">
        <span>Trigger</span>
      </Tooltip>
    )
    const tooltip = screen.getByRole('tooltip')
    const wrapper = tooltip.parentElement!
    expect(wrapper.className).toContain('custom-class')
  })
})
