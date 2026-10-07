import { type RefObject, useEffect } from 'react'
import { useUi } from '@/store/ui'

/** Measures the app chrome and paper into the UI store so the preview can scale and stick. */
export function useLayoutMetrics({
  header,
  tabs,
  workspace,
  paper,
}: {
  header: RefObject<HTMLElement | null>
  tabs: RefObject<HTMLElement | null>
  workspace: RefObject<HTMLElement | null>
  paper: RefObject<HTMLElement | null>
}) {
  useEffect(() => {
    const paperEl = paper.current,
      workspaceEl = workspace.current,
      headerEl = header.current
    if (!paperEl || !workspaceEl || !headerEl) return
    const { setMetrics } = useUi.getState()
    const observer = new ResizeObserver(() => {
      setMetrics({
        ...(paperEl.offsetHeight > 0 ? { paperHeight: paperEl.offsetHeight } : {}),
        availableWidth: workspaceEl.clientWidth,
        actionHeight: headerEl.offsetHeight,
        headerHeight: headerEl.offsetHeight + (tabs.current?.offsetHeight ?? 0),
      })
    })
    observer.observe(paperEl)
    observer.observe(workspaceEl)
    observer.observe(headerEl)
    if (tabs.current) observer.observe(tabs.current)
    return () => observer.disconnect()
  }, [header, tabs, workspace, paper])
}
