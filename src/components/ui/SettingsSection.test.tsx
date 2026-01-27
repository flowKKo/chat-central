import { render, screen } from '@testing-library/react'
import { Sun } from 'lucide-react'
import { describe, expect, it } from 'vitest'
import { SettingsSection } from './SettingsSection'

describe('settingsSection', () => {
  const defaultProps = {
    icon: Sun,
    iconColor: 'text-primary',
    iconBgColor: 'bg-primary/10',
    title: 'Test Section',
    description: 'Test description',
  }

  it('should render title and description', () => {
    render(
      <SettingsSection {...defaultProps}>
        <p>Content</p>
      </SettingsSection>
    )
    expect(screen.getByText('Test Section')).toBeInTheDocument()
    expect(screen.getByText('Test description')).toBeInTheDocument()
  })

  it('should render children', () => {
    render(
      <SettingsSection {...defaultProps}>
        <p>Child content</p>
      </SettingsSection>
    )
    expect(screen.getByText('Child content')).toBeInTheDocument()
  })

  it('should render as a section element', () => {
    render(
      <SettingsSection {...defaultProps}>
        <p>Content</p>
      </SettingsSection>
    )
    const section = screen.getByText('Test Section').closest('section')
    expect(section).toBeInTheDocument()
    expect(section?.className).toContain('rounded-2xl')
  })

  it('should apply custom className', () => {
    render(
      <SettingsSection {...defaultProps} className="custom-class">
        <p>Content</p>
      </SettingsSection>
    )
    const section = screen.getByText('Test Section').closest('section')
    expect(section?.className).toContain('custom-class')
  })
})
