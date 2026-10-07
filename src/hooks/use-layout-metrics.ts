import { type RefObject, useEffect, useState } from 'react'

/** Measures the app chrome and paper so the preview can scale and stick correctly. */
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
  const [paperHeight, setPaperHeight] = useState(1122)
  const [availableWidth, setAvailableWidth] = useState(900)
  const [headerHeight, setHeaderHeight] = useState(68)
  const [actionHeight, setActionHeight] = useState(68)
  useEffect(() => {
    const paperEl = paper.current,
      workspaceEl = workspace.current,
      headerEl = header.current
    if (!paperEl || !workspaceEl || !headerEl) return
    const observer = new ResizeObserver(() => {
      if (paperEl.offsetHeight > 0) setPaperHeight(paperEl.offsetHeight)
      setAvailableWidth(workspaceEl.clientWidth)
      setActionHeight(headerEl.offsetHeight)
      setHeaderHeight(headerEl.offsetHeight + (tabs.current?.offsetHeight ?? 0))
    })
    observer.observe(paperEl)
    observer.observe(workspaceEl)
    observer.observe(headerEl)
    if (tabs.current) observer.observe(tabs.current)
    return () => observer.disconnect()
  }, [header, tabs, workspace, paper])
  return { paperHeight, availableWidth, headerHeight, actionHeight }
}
