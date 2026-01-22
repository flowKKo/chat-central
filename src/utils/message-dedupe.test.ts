import { describe, it, expect } from 'vitest'
import { dedupeMessagesByContent } from './message-dedupe'
import type { Message } from '@/types'

describe('dedupeMessagesByContent', () => {
  const baseMessage: Message = {
    id: 'm1',
    conversationId: 'conv1',
    role: 'user',
    content: 'Hello',
    createdAt: 1,
  }

  it('keeps message id when content matches existing', () => {
    const existing = new Map<string, Message>([['m1', { ...baseMessage }]])
    const result = dedupeMessagesByContent([{ ...baseMessage }], existing)
    expect(result[0]?.id).toBe('m1')
  })

  it('renames message id when content differs', () => {
    const existing = new Map<string, Message>([['m1', { ...baseMessage }]])
    const result = dedupeMessagesByContent(
      [{ ...baseMessage, content: 'Different' }],
      existing
    )
    expect(result[0]?.id).toBe('m1_dup1')
  })

  it('skips used suffixes', () => {
    const existing = new Map<string, Message>([
      ['m1', { ...baseMessage }],
      ['m1_dup1', { ...baseMessage, id: 'm1_dup1' }],
    ])
    const result = dedupeMessagesByContent(
      [{ ...baseMessage, content: 'Different' }],
      existing
    )
    expect(result[0]?.id).toBe('m1_dup2')
  })
})
