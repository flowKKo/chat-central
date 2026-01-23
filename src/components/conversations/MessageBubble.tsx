import { User, Bot } from 'lucide-react'
import type { Message } from '@/types'
import { cn } from '@/utils/cn'
import { HighlightText } from '../HighlightText'

interface MessageBubbleProps {
  message: Message
  platformColor: string
  searchQuery?: string
  style?: React.CSSProperties
}

export function MessageBubble({
  message,
  platformColor,
  searchQuery,
  style,
}: MessageBubbleProps) {
  const isUser = message.role === 'user'

  return (
    <div
      data-message-id={message.id}
      className={cn('flex gap-3 animate-slide-in transition-all rounded-xl', isUser && 'flex-row-reverse')}
      style={style}
    >
      {/* Avatar */}
      <div
        className={cn(
          'w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0',
          isUser ? 'bg-primary/20' : 'bg-muted'
        )}
        style={!isUser ? { backgroundColor: `${platformColor}12` } : undefined}
      >
        {isUser ? (
          <User className="w-4 h-4 text-primary" />
        ) : (
          <Bot className="w-4 h-4" style={{ color: platformColor }} />
        )}
      </div>

      {/* Bubble */}
      <div
        className={cn(
          'flex-1 max-w-[85%] rounded-2xl px-4 py-3',
          isUser
            ? 'bg-primary/15 text-foreground ml-auto'
            : 'bg-muted/50 border border-border/50'
        )}
      >
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            {isUser ? 'You' : 'Assistant'}
          </span>
          {message.createdAt && (
            <span className="text-[10px] text-muted-foreground/50 tabular-nums">
              {formatMessageTime(message.createdAt)}
            </span>
          )}
        </div>
        <div className="text-sm whitespace-pre-wrap leading-relaxed">
          {searchQuery ? (
            <HighlightText text={message.content} query={searchQuery} />
          ) : (
            message.content
          )}
        </div>
      </div>
    </div>
  )
}

function formatMessageTime(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}
