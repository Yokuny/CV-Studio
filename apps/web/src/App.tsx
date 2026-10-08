import { type CSSProperties, useEffect, useRef } from 'react';
import { AppHeader } from '@/components/app-header';
import { DeleteVersionDialog } from '@/components/delete-version-dialog';
import { DesignPanel } from '@/components/design-panel';
import { JobDialog } from '@/components/job-dialog';
import { MailAccountDialog } from '@/components/mail-account-dialog';
import { NewVersionDialog } from '@/components/new-version-dialog';
import { ResumeActions } from '@/components/resume-actions';
import { SendDialog } from '@/components/send-dialog';
import { Toast } from '@/components/toast';
import { VersionBar } from '@/components/version-bar';
import { ViewSwitch } from '@/components/view-switch';
import { Workspace } from '@/components/workspace';
import { useLayoutMetrics } from '@/hooks/use-layout-metrics';
import { selectCurrent, selectHasDrafts, selectHasVersion, useResumes } from '@/store/resumes';
import { useUi } from '@/store/ui';

/**
 * With ?print=<slug>, the local API opens this page in Chromium to print the PDF attached to
 * an email. The page selects that version and flags when fonts and layout are ready.
 */
async function markPrintReady() {
  const id = new URLSearchParams(window.location.search).get('print');
  if (id === null) return;
  const { versions, select } = useResumes.getState();
  const found = versions.some((v) => v.id === id);
  if (found) select(id);
  await document.fonts.ready;
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  document.documentElement.dataset.printReady = found ? 'ready' : 'missing';
}

export default function App() {
  const { name, layout } = useResumes(selectCurrent);
  const hasVersion = useResumes(selectHasVersion);
  // The jobs view has nothing to design; the sidebar comes back with the resume views.
  const sidebarOpen = useUi((s) => s.sidebarOpen && s.preview !== 'jobs');
  const headerHeight = useUi((s) => s.metrics.headerHeight);
  const actionHeight = useUi((s) => s.metrics.actionHeight);
  const headerRef = useRef<HTMLElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<HTMLElement>(null);
  const paperRef = useRef<HTMLElement>(null);
  useLayoutMetrics({ header: headerRef, tabs: tabsRef, workspace: workspaceRef, paper: paperRef });

  useEffect(() => {
    void useResumes.getState().load().then(markPrintReady);
    const warnAboutDrafts = (event: BeforeUnloadEvent) => {
      if (!selectHasDrafts(useResumes.getState())) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnAboutDrafts);
    return () => window.removeEventListener('beforeunload', warnAboutDrafts);
  }, []);
  useEffect(() => {
    document.title = `${name} — CV Studio`;
  }, [name]);

  return (
    <div
      className="app-shell"
      style={
        {
          '--app-header-height': `${headerHeight}px`,
          '--action-header-height': `${actionHeight}px`,
        } as CSSProperties
      }
    >
      <style>{`@page { size: A4; margin: ${layout.margin}mm; }`}</style>
      <AppHeader ref={headerRef}>
        <ViewSwitch />
        <ResumeActions />
      </AppHeader>
      <VersionBar ref={tabsRef} />
      <div className={`studio-layout ${sidebarOpen && hasVersion ? '' : 'sidebar-collapsed'}`}>
        <aside
          id="editor-sidebar"
          className="sidebar no-print"
          hidden={!sidebarOpen || !hasVersion}
          aria-label="Ajustes do currículo"
        >
          <DesignPanel />
        </aside>
        <Workspace ref={workspaceRef} paperRef={paperRef} />
      </div>
      <Toast />
      <DeleteVersionDialog />
      <NewVersionDialog />
      <JobDialog />
      <SendDialog />
      <MailAccountDialog />
    </div>
  );
}
