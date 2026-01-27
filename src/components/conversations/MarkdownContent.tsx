import { memo } from 'react'
import type { Components } from 'react-markdown'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkGfm from 'remark-gfm'
import { cn } from '@/utils/cn'

interface MarkdownContentProps {
  content: string
}

const components: Components = {
  code({ className, children, ...props }) {
    const isBlock = className?.startsWith('hljs') || className?.startsWith('language-')
    if (isBlock) {
      return (
        <code className={cn('text-[13px]', className)} {...props}>
          {children}
        </code>
      )
    }
    return (
      <code className="rounded bg-muted px-1.5 py-0.5 text-[13px]" {...props}>
        {children}
      </code>
    )
  },
  pre({ children }) {
    return <pre className="my-3 overflow-x-auto rounded-lg bg-muted p-4 text-sm">{children}</pre>
  },
  a({ children, href, ...props }) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline underline-offset-2 hover:text-primary/80"
        {...props}
      >
        {children}
      </a>
    )
  },
  table({ children }) {
    return (
      <div className="my-3 overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">{children}</table>
      </div>
    )
  },
  thead({ children }) {
    return <thead className="border-b border-border bg-muted/50">{children}</thead>
  },
  tbody({ children }) {
    return <tbody className="divide-y divide-border">{children}</tbody>
  },
  tr({ children }) {
    return <tr>{children}</tr>
  },
  th({ children }) {
    return (
      <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">
        {children}
      </th>
    )
  },
  td({ children }) {
    return <td className="px-3 py-2">{children}</td>
  },
  blockquote({ children }) {
    return (
      <blockquote className="my-3 border-l-4 border-primary/30 bg-muted/30 py-1 pl-4 italic text-muted-foreground">
        {children}
      </blockquote>
    )
  },
  ul({ children }) {
    return <ul className="my-2 list-disc space-y-1 pl-6">{children}</ul>
  },
  ol({ children }) {
    return <ol className="my-2 list-decimal space-y-1 pl-6">{children}</ol>
  },
  li({ children }) {
    return <li className="leading-relaxed">{children}</li>
  },
  h1({ children }) {
    return <h1 className="mb-3 mt-5 text-2xl font-bold">{children}</h1>
  },
  h2({ children }) {
    return <h2 className="mb-2 mt-4 text-xl font-bold">{children}</h2>
  },
  h3({ children }) {
    return <h3 className="mb-2 mt-3 text-lg font-semibold">{children}</h3>
  },
  h4({ children }) {
    return <h4 className="mb-1 mt-3 text-base font-semibold">{children}</h4>
  },
  h5({ children }) {
    return <h5 className="mb-1 mt-2 text-sm font-semibold">{children}</h5>
  },
  h6({ children }) {
    return <h6 className="mb-1 mt-2 text-xs font-semibold">{children}</h6>
  },
  p({ children }) {
    return <p className="my-2 leading-relaxed">{children}</p>
  },
  hr() {
    return <hr className="my-4 border-border" />
  },
}

export const MarkdownContent = memo(({ content }: MarkdownContentProps) => (
  <ReactMarkdown
    remarkPlugins={[remarkGfm]}
    rehypePlugins={[rehypeHighlight]}
    components={components}
  >
    {content}
  </ReactMarkdown>
))
