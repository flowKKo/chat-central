import { describe, expect, it } from 'vitest'
import { extractMessageContent, extractRole, truncateText } from './content'

describe('content utilities', () => {
  describe('extractMessageContent', () => {
    describe('direct fields', () => {
      it('should extract from direct text field', () => {
        const item = { text: 'Hello world' }
        expect(extractMessageContent(item)).toBe('Hello world')
      })

      it('should extract from direct content field (string)', () => {
        const item = { content: 'Hello world' }
        expect(extractMessageContent(item)).toBe('Hello world')
      })

      it('should prefer text over content', () => {
        const item = { text: 'from text', content: 'from content' }
        expect(extractMessageContent(item)).toBe('from text')
      })
    })

    describe('nested content object', () => {
      it('should extract from content.text', () => {
        const item = { content: { text: 'Nested text' } }
        expect(extractMessageContent(item)).toBe('Nested text')
      })

      it('should extract from content.parts array (strings)', () => {
        const item = { content: { parts: ['Part 1', 'Part 2', 'Part 3'] } }
        expect(extractMessageContent(item)).toBe('Part 1\nPart 2\nPart 3')
      })

      it('should filter non-string parts', () => {
        const item = { content: { parts: ['Valid', null, 123, 'Also valid'] } }
        expect(extractMessageContent(item)).toBe('Valid\nAlso valid')
      })
    })

    describe('content as array (OpenAI/Claude format)', () => {
      it('should extract from array of strings', () => {
        const item = { content: ['Line 1', 'Line 2'] }
        expect(extractMessageContent(item)).toBe('Line 1\nLine 2')
      })

      it('should extract from array of objects with text field', () => {
        const item = { content: [{ text: 'First' }, { text: 'Second' }] }
        expect(extractMessageContent(item)).toBe('First\nSecond')
      })

      it('should extract from array with type="text" objects', () => {
        const item = {
          content: [
            { type: 'text', text: 'Text block' },
            { type: 'image', url: 'http://...' },
            { type: 'text', text: 'Another text' },
          ],
        }
        expect(extractMessageContent(item)).toBe('Text block\nAnother text')
      })

      it('should handle mixed content array', () => {
        const item = {
          content: [
            'String item',
            { text: 'Object with text' },
            { type: 'text', text: 'Typed text' },
            null,
            42,
          ],
        }
        const result = extractMessageContent(item)
        expect(result).toContain('String item')
        expect(result).toContain('Object with text')
        expect(result).toContain('Typed text')
      })
    })

    describe('blocks array (Claude format)', () => {
      it('should extract from blocks array', () => {
        const item = {
          blocks: [
            { type: 'text', text: 'Block 1' },
            { type: 'text', text: 'Block 2' },
          ],
        }
        expect(extractMessageContent(item)).toBe('Block 1\nBlock 2')
      })

      it('should filter non-text blocks', () => {
        const item = {
          blocks: [
            { type: 'text', text: 'Text block' },
            { type: 'code', code: 'console.log()' },
            { type: 'text', text: 'Another text' },
          ],
        }
        expect(extractMessageContent(item)).toBe('Text block\nAnother text')
      })

      it('should handle blocks without type', () => {
        const item = {
          blocks: [{ text: 'No type' }, { type: 'text', text: 'With type' }],
        }
        expect(extractMessageContent(item)).toBe('With type')
      })
    })

    describe('edge cases', () => {
      it('should return empty string for null', () => {
        expect(extractMessageContent(null)).toBe('')
      })

      it('should return empty string for undefined', () => {
        expect(extractMessageContent(undefined)).toBe('')
      })

      it('should return empty string for non-object', () => {
        expect(extractMessageContent('string')).toBe('')
        expect(extractMessageContent(123)).toBe('')
        expect(extractMessageContent(true)).toBe('')
      })

      it('should return empty string for empty object', () => {
        expect(extractMessageContent({})).toBe('')
      })

      it('should return empty string for object without extractable content', () => {
        const item = { id: '123', timestamp: 1000 }
        expect(extractMessageContent(item)).toBe('')
      })

      it('should filter empty strings from results', () => {
        const item = { content: ['', 'Valid', '', 'Also valid', ''] }
        expect(extractMessageContent(item)).toBe('Valid\nAlso valid')
      })
    })
  })

  describe('extractRole', () => {
    describe('sender field', () => {
      it('should extract human as user', () => {
        expect(extractRole({ sender: 'human' })).toBe('user')
        expect(extractRole({ sender: 'Human' })).toBe('user')
        expect(extractRole({ sender: 'HUMAN' })).toBe('user')
      })

      it('should extract user as user', () => {
        expect(extractRole({ sender: 'user' })).toBe('user')
        expect(extractRole({ sender: 'User' })).toBe('user')
      })

      it('should extract assistant as assistant', () => {
        expect(extractRole({ sender: 'assistant' })).toBe('assistant')
        expect(extractRole({ sender: 'Assistant' })).toBe('assistant')
      })

      it('should extract model as assistant', () => {
        expect(extractRole({ sender: 'model' })).toBe('assistant')
        expect(extractRole({ sender: 'Model' })).toBe('assistant')
      })

      it('should extract ai as assistant', () => {
        expect(extractRole({ sender: 'ai' })).toBe('assistant')
        expect(extractRole({ sender: 'AI' })).toBe('assistant')
      })
    })

    describe('author field', () => {
      it('should use author field', () => {
        expect(extractRole({ author: 'human' })).toBe('user')
        expect(extractRole({ author: 'assistant' })).toBe('assistant')
      })
    })

    describe('role field', () => {
      it('should use role field', () => {
        expect(extractRole({ role: 'user' })).toBe('user')
        expect(extractRole({ role: 'assistant' })).toBe('assistant')
      })
    })

    describe('field priority', () => {
      it('should check sender first', () => {
        const msg = { sender: 'human', author: 'assistant', role: 'model' }
        expect(extractRole(msg)).toBe('user')
      })
    })

    describe('edge cases', () => {
      it('should return null for null', () => {
        expect(extractRole(null)).toBeNull()
      })

      it('should return null for undefined', () => {
        expect(extractRole(undefined)).toBeNull()
      })

      it('should return null for non-object', () => {
        expect(extractRole('string')).toBeNull()
        expect(extractRole(123)).toBeNull()
      })

      it('should return null for unknown role', () => {
        expect(extractRole({ sender: 'system' })).toBeNull()
        expect(extractRole({ role: 'tool' })).toBeNull()
      })

      it('should return null for non-string role', () => {
        expect(extractRole({ sender: 123 })).toBeNull()
        expect(extractRole({ role: null })).toBeNull()
      })

      it('should return null for missing role fields', () => {
        expect(extractRole({ id: '123', content: 'test' })).toBeNull()
      })
    })
  })

  describe('truncateText', () => {
    it('should return text unchanged if within limit', () => {
      const text = 'Short text'
      expect(truncateText(text, 100)).toBe(text)
    })

    it('should return text unchanged if exactly at limit', () => {
      const text = 'Exact'
      expect(truncateText(text, 5)).toBe(text)
    })

    it('should truncate at word boundary when possible', () => {
      const text = 'This is a long sentence that needs truncation'
      const result = truncateText(text, 20)
      expect(result.length).toBeLessThanOrEqual(20)
      expect(result).not.toContain('sentence') // should cut before this word
    })

    it('should hard truncate if no good word boundary', () => {
      const text = 'Verylongwordwithoutspaces'
      const result = truncateText(text, 10)
      expect(result.length).toBe(10)
      expect(result).toBe('Verylongwo')
    })

    it('should prefer word boundary if space is within 70% of maxLength', () => {
      const text = 'Word boundary test'
      const result = truncateText(text, 15)
      // 'Word boundary' = 13 chars, which is > 70% of 15 (10.5)
      expect(result).toBe('Word boundary')
    })

    it('should hard truncate if word boundary is too early', () => {
      const text = 'A verylongwordhere'
      const result = truncateText(text, 10)
      // Space at index 1 is < 70% of 10 (7), so hard truncate to maxLength
      expect(result).toBe('A verylong')
    })

    it('should handle empty string', () => {
      expect(truncateText('', 10)).toBe('')
    })

    it('should handle maxLength of 0', () => {
      expect(truncateText('text', 0)).toBe('')
    })
  })
})
