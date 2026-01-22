import type { Message } from '@/types'

export function dedupeMessagesByContent(
  messages: Message[],
  existing: Map<string, Message>
): Message[] {
  if (messages.length === 0) return messages

  const used = new Set(messages.map((message) => message.id))

  return messages.map((message) => {
    const stored = existing.get(message.id)
    if (!stored) return message

    if (stored.content.trim() === message.content.trim()) return message

    let suffix = 1
    let candidate = `${message.id}_dup${suffix}`
    while (used.has(candidate) || existing.has(candidate)) {
      suffix += 1
      candidate = `${message.id}_dup${suffix}`
    }

    used.add(candidate)
    return { ...message, id: candidate }
  })
}
