import { User, Bot } from 'lucide-react'
import type { Message } from '@/types'
import { cn } from '@/utils/cn'
import { MarkdownContent } from './MarkdownContent'

interface MessageBubbleProps {
  message: Message
  platformColor: string
}

export function MessageBubble({ message, platformColor }: MessageBubbleProps) {
  const isUser = message.role === 'user'

  return (
    <div
      data-message-id={message.id}
      className={cn('flex gap-3 rounded-xl', isUser && 'flex-row-reverse')}
    >
      {/* Avatar */}
      <div
        className={cn(
          'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl',
          isUser ? 'bg-primary/20' : 'bg-muted'
        )}
        style={!isUser ? { backgroundColor: `${platformColor}12` } : undefined}
      >
        {isUser ? (
          <User className="h-4 w-4 text-primary" />
        ) : (
          <Bot className="h-4 w-4" style={{ color: platformColor }} />
        )}
      </div>

      {/* Bubble */}
      <div
        className={cn(
          'max-w-[85%] flex-1 rounded-2xl px-4 py-3',
          isUser ? 'ml-auto bg-primary/15 text-foreground' : 'border border-border/50 bg-muted/50'
        )}
      >
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            {isUser ? 'You' : 'Assistant'}
          </span>
          {message.createdAt && (
            <span className="text-[10px] tabular-nums text-muted-foreground/50">
              {formatMessageTime(message.createdAt)}
            </span>
          )}
        </div>
        <div className="text-sm leading-relaxed">
          <MarkdownContent content={message.content} />
        </div>
      </div>
    </div>
  )
}

function formatMessageTime(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}
