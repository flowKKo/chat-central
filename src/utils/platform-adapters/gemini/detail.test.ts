import { describe, it, expect } from 'vitest'
import { parseConversationDetailPayload } from './detail'

const NOW = 1700000000000

describe('parseConversationDetailPayload', () => {
  it('should parse a simple user + assistant exchange from array format', () => {
    // Simulates Gemini nested array format:
    // [[conversationId, responseId], null, [[userText], ...], [[responseId, [assistantText], ...]]]
    const payload = [
      [
        ['c_conv1', 'r_resp1'],
        null,
        [['Hello, Gemini!'], 2, null, 0, 'hash1', 0],
        [['rc_reply1', ['Hello! How can I help?'], null, null, null, null, null]],
      ],
      [1700000100, 0],
    ]

    const result = parseConversationDetailPayload(payload, NOW)
    expect(result).not.toBeNull()
    expect(result!.messages).toHaveLength(2)
    expect(result!.messages[0]!.role).toBe('user')
    expect(result!.messages[0]!.content).toBe('Hello, Gemini!')
    expect(result!.messages[1]!.role).toBe('assistant')
    expect(result!.messages[1]!.content).toBe('Hello! How can I help?')
  })

  it('should extract conversation ID from payload', () => {
    const payload = [
      [
        ['c_myconv', 'r_resp1'],
        null,
        [['Question'], 2, null, 0, 'hash1', 0],
        [[['rc_reply1', ['Answer'], null, null, null, null, null]]],
      ],
      [1700000100, 0],
    ]

    const result = parseConversationDetailPayload(payload, NOW)
    expect(result).not.toBeNull()
    expect(result!.conversation.originalId).toBe('myconv')
    expect(result!.conversation.id).toBe('gemini_myconv')
  })

  it('should return null when no conversation ID is found', () => {
    const payload = [
      [['Question'], 2, null, 0],
      [[['rc_reply1', ['Answer'], null, null, null, null, null]]],
    ]
    const result = parseConversationDetailPayload(payload, NOW)
    expect(result).toBeNull()
  })

  it('should return null when no messages are found', () => {
    const payload = { conversationId: 'c_abc123' }
    const result = parseConversationDetailPayload(payload, NOW)
    expect(result).toBeNull()
  })

  it('should return null for null/undefined input', () => {
    expect(parseConversationDetailPayload(null, NOW)).toBeNull()
    expect(parseConversationDetailPayload(undefined, NOW)).toBeNull()
  })

  it('should parse messages from object format with author field', () => {
    const payload = {
      conversationId: 'c_obj1',
      messages: [
        { id: 'msg1', author: 'user', text: 'User question', createdAt: 1700000100000 },
        { id: 'msg2', author: 'model', text: 'Assistant answer', createdAt: 1700000200000 },
      ],
    }

    const result = parseConversationDetailPayload(payload, NOW)
    expect(result).not.toBeNull()
    expect(result!.messages).toHaveLength(2)
    expect(result!.messages[0]!.role).toBe('user')
    expect(result!.messages[1]!.role).toBe('assistant')
  })

  it('should sort messages chronologically', () => {
    // Two turns in reverse order
    const payload = [
      [
        [
          ['c_conv1', 'r_resp2'],
          ['c_conv1', 'r_resp1', 'rc_reply1'],
          [['Second question'], 2, null, 0, 'hash2', 0],
          [[['rc_reply2', ['Second answer'], null, null, null, null, null]]],
        ],
        [1700000200, 0],
      ],
      [
        [
          ['c_conv1', 'r_resp1'],
          null,
          [['First question'], 2, null, 0, 'hash1', 0],
          [[['rc_reply1', ['First answer'], null, null, null, null, null]]],
        ],
        [1700000100, 0],
      ],
    ]

    const result = parseConversationDetailPayload(payload, NOW)
    expect(result).not.toBeNull()
    const contents = result!.messages.map((m) => m.content)
    expect(contents[0]).toBe('First question')
    expect(contents[1]).toBe('First answer')
    expect(contents[2]).toBe('Second question')
    expect(contents[3]).toBe('Second answer')
  })

  it('should set conversation URL correctly', () => {
    const payload = [
      [
        ['c_testid', 'r_resp1'],
        null,
        [['Hello'], 2, null, 0, 'hash1', 0],
        [[['rc_r1', ['Hi'], null, null, null, null, null]]],
      ],
      [1700000100, 0],
    ]

    const result = parseConversationDetailPayload(payload, NOW)
    expect(result).not.toBeNull()
    expect(result!.conversation.url).toBe('https://gemini.google.com/app/testid')
  })

  it('should use earliest user message as title', () => {
    const payload = [
      [
        [
          ['c_conv1', 'r_resp2'],
          ['c_conv1', 'r_resp1', 'rc_reply1'],
          [['Later question'], 2, null, 0, 'hash2', 0],
          [[['rc_reply2', ['Later answer'], null, null, null, null, null]]],
        ],
        [1700000200, 0],
      ],
      [
        [
          ['c_conv1', 'r_resp1'],
          null,
          [['First user message as title'], 2, null, 0, 'hash1', 0],
          [[['rc_reply1', ['First answer'], null, null, null, null, null]]],
        ],
        [1700000100, 0],
      ],
    ]

    const result = parseConversationDetailPayload(payload, NOW)
    expect(result).not.toBeNull()
    expect(result!.conversation.title).toBe('First user message as title')
  })

  it('should set detailStatus to full', () => {
    const payload = [
      [
        ['c_conv1', 'r_resp1'],
        null,
        [['Hello'], 2, null, 0, 'hash1', 0],
        [[['rc_r1', ['Hi'], null, null, null, null, null]]],
      ],
      [1700000100, 0],
    ]

    const result = parseConversationDetailPayload(payload, NOW)
    expect(result!.conversation.detailStatus).toBe('full')
    expect(result!.conversation.detailSyncedAt).toBe(NOW)
  })

  it('should generate unique message IDs', () => {
    const payload = [
      [
        ['c_conv1', 'r_resp1'],
        null,
        [['Msg 1'], 2, null, 0, 'hash1', 0],
        [[['rc_r1', ['Reply 1'], null, null, null, null, null]]],
      ],
      [1700000100, 0],
    ]

    const result = parseConversationDetailPayload(payload, NOW)
    expect(result).not.toBeNull()
    const ids = result!.messages.map((m) => m.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
  })

  it('should set preview from first user message content', () => {
    const payload = [
      [
        ['c_conv1', 'r_resp1'],
        null,
        [['This is the user preview text'], 2, null, 0, 'hash1', 0],
        [[['rc_r1', ['Assistant reply'], null, null, null, null, null]]],
      ],
      [1700000100, 0],
    ]

    const result = parseConversationDetailPayload(payload, NOW)
    expect(result).not.toBeNull()
    expect(result!.conversation.preview).toBe('This is the user preview text')
  })

  it('should handle conversation ID in object format', () => {
    const payload = {
      conversation_id: 'c_fromobj',
      title: 'Object Title',
      messages: [{ id: 'msg1', author: 'user', text: 'Hello', createdAt: 1700000100000 }],
    }

    const result = parseConversationDetailPayload(payload, NOW)
    expect(result).not.toBeNull()
    expect(result!.conversation.originalId).toBe('fromobj')
  })
})
