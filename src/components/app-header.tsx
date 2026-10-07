import { FileText } from 'lucide-react'
import type { ReactNode, Ref } from 'react'

export function AppHeader({ ref, children }: { ref?: Ref<HTMLElement>; children: ReactNode }) {
  return (
    <header ref={ref} className="app-header no-print">
      <div className="header-identity">
        <a href="/" className="brand" aria-label="CV Studio início">
          <span className="brand-icon">
            <FileText size={21} />
          </span>
          <span>
            cv<span className="font-normal">studio</span>
            <span className="brand-dot">.</span>
          </span>
        </a>
      </div>
      {children}
    </header>
  )
}
