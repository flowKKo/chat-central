import { describe, expect, it } from 'vitest'
import { geminiAdapter } from './gemini'

// Multi-turn conversation payload in reverse chronological order (newest first)
// This matches the actual Gemini API response format
const multiTurnDetailPayload = [
  [
    // Turn 3 (newest) - "OPT也是F1的一种吗"
    [
      ['c_2dd9617c8af9b0ed', 'r_bc4be9797fd7879d'],
      ['c_2dd9617c8af9b0ed', 'r_ad3b5d7ee4bf4085', 'rc_c994a52ae507937e'],
      [['OPT也是F1的一种吗'], 2, null, 0, '5bf011840784117a', 0],
      [
        [
          [
            'rc_b8b14fa605dff0f0',
            ['是的，完全正确。OPT是F-1身份的延伸。'],
            null,
            null,
            null,
            null,
            null,
          ],
        ],
      ],
    ],
    [1757400162, 42463000],
  ],
  [
    // Turn 2 - "OPT签证算NRA吗"
    [
      ['c_2dd9617c8af9b0ed', 'r_ad3b5d7ee4bf4085'],
      ['c_2dd9617c8af9b0ed', 'r_17baba4689cc9937', 'rc_e3fcfaa8da4bdaf3'],
      [['OPT签证算NRA吗'], 2, null, 0, '5bf011840784117a', 0],
      [
        [
          [
            'rc_c994a52ae507937e',
            ['通常情况下，持有OPT的人税务身份是NRA。'],
            null,
            null,
            null,
            null,
            null,
          ],
        ],
      ],
    ],
    [1757400124, 921607000],
  ],
  [
    // Turn 1 (oldest) - "我的身份是F1学生..."
    [
      ['c_2dd9617c8af9b0ed', 'r_17baba4689cc9937'],
      null,
      [['我的身份是F1学生，在TopStep做DayTrade有税务问题吗'], 2, null, 0, '5bf011840784117a', 0],
      [
        [
          [
            'rc_e3fcfaa8da4bdaf3',
            ['F1学生在TopStep平台做Day Trading存在税务与身份风险。'],
            null,
            null,
            null,
            null,
            null,
          ],
        ],
      ],
    ],
    [1757399595, 770176000],
  ],
]

const detailPayload = [
  [
    [
      ['c_d79ad3947b534851', 'r_bd9c7a5d8d5312b2'],
      ['c_d79ad3947b534851', 'r_6db44eb4174ae786', 'rc_36e470914015abab'],
      [['真的吗'], 1, null, 0, 'fbb127bbb056c959', 0],
      [['rc_889231ddf5065170', ['是真的！'], null, null, null, null, null]],
      null,
      null,
      'rc_889231ddf5065170',
      null,
      null,
      null,
      null,
      'US',
      true,
      false,
      null,
      [],
      null,
      'fbb127bbb056c959',
      null,
      null,
      'fbb127bbb056c959',
      null,
      null,
      null,
      'Fast',
    ],
    [1769121624, 990806000],
  ],
  [
    [
      ['c_d79ad3947b534851', 'r_6db44eb4174ae786'],
      null,
      [
        [
          '可以对Gemini同时并行进行2、3个问题的提问，并且收集他们的回答，同时展示吗？我想在网页端实现这个功能',
        ],
        1,
        null,
        0,
        '9d8ca3786ebdfbea',
        0,
      ],
      [['rc_36e470914015abab', ['是的，完全可以'], null, null, null, null, null]],
      null,
      '9d8ca3786ebdfbea',
      null,
      null,
      '9d8ca3786ebdfbea',
      null,
      null,
      null,
      '3 Pro',
    ],
    [1768904216, 67961000],
  ],
]

describe('geminiAdapter.parseConversationDetail', () => {
  it('parses all messages and orders them chronologically', () => {
    const result = geminiAdapter.parseConversationDetail(detailPayload)
    expect(result).not.toBeNull()
    if (!result) return

    const contents = result.messages.map((message) => message.content)
    expect(contents).toEqual([
      '可以对Gemini同时并行进行2、3个问题的提问，并且收集他们的回答，同时展示吗？我想在网页端实现这个功能',
      '是的，完全可以',
      '真的吗',
      '是真的！',
    ])
  })

  it('handles reverse-ordered multi-turn conversations correctly', () => {
    const result = geminiAdapter.parseConversationDetail(multiTurnDetailPayload)
    expect(result).not.toBeNull()
    if (!result) return

    // Should have 6 messages (3 user + 3 assistant)
    expect(result.messages).toHaveLength(6)

    // Messages should be ordered chronologically (oldest first)
    const contents = result.messages.map((m) => m.content)
    expect(contents[0]).toContain('我的身份是F1学生')
    expect(contents[1]).toContain('F1学生在TopStep平台')
    expect(contents[2]).toContain('OPT签证算NRA吗')
    expect(contents[3]).toContain('通常情况下')
    expect(contents[4]).toContain('OPT也是F1的一种吗')
    expect(contents[5]).toContain('是的，完全正确')

    // Roles should alternate: user, assistant, user, assistant, user, assistant
    const roles = result.messages.map((m) => m.role)
    expect(roles).toEqual(['user', 'assistant', 'user', 'assistant', 'user', 'assistant'])
  })

  it('uses earliest user message as title, not the newest', () => {
    const result = geminiAdapter.parseConversationDetail(multiTurnDetailPayload)
    expect(result).not.toBeNull()
    if (!result) return

    // Title should be from the earliest user message, not the latest
    expect(result.conversation.title).toContain('我的身份是F1学生')
    expect(result.conversation.title).not.toContain('OPT也是F1的一种吗')
  })

  it('generates unique IDs for messages with same raw ID field', () => {
    const result = geminiAdapter.parseConversationDetail(multiTurnDetailPayload)
    expect(result).not.toBeNull()
    if (!result) return

    // All message IDs should be unique
    const ids = result.messages.map((m) => m.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
  })
})
