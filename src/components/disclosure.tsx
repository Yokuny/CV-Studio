import type { ReactNode } from 'react'

export function Disclosure({
  className,
  summary,
  children,
}: {
  className: string
  summary: ReactNode
  children: ReactNode
}) {
  return (
    <details className={className}>
      <summary>{summary}</summary>
      {children}
    </details>
  )
}
