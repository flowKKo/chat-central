import { useTranslation } from 'react-i18next'
import { ChevronRight } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { cn } from '@/utils/cn'

export function SummaryBlock({ summary }: { summary: string }) {
  const { t } = useTranslation('common')
  const [expanded, setExpanded] = useState(false)
  const [clamped, setClamped] = useState(false)
  const textRef = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    const el = textRef.current
    if (el) {
      setClamped(el.scrollHeight > el.clientHeight)
    }
  }, [summary])

  return (
    <div className="mt-4 rounded-xl bg-muted/40 px-4 py-3">
      <div className="mb-1 text-xs font-medium text-foreground/50">{t('summary')}</div>
      <p
        ref={textRef}
        className={cn('text-sm leading-relaxed text-foreground/80', !expanded && 'line-clamp-2')}
      >
        {summary}
      </p>
      {clamped && (
        <button
          type="button"
          aria-expanded={expanded}
          className="mt-1 flex cursor-pointer items-center gap-0.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          onClick={() => setExpanded(!expanded)}
        >
          <ChevronRight className={cn('h-3 w-3 transition-transform', expanded && 'rotate-90')} />
          {expanded ? t('showLess') : t('showMore')}
        </button>
      )}
    </div>
  )
}
