import { selectHasVersion, useResumes } from '@/store/resumes';

export function StaticBanner() {
  const visible = useResumes((s) => !s.writable && s.ready && selectHasVersion(s));
  const exportSources = useResumes((s) => s.exportSources);
  if (!visible) return null;
  return (
    <div className="static-banner no-print">
      Modo de prévia: rascunhos ficam neste navegador.{' '}
      <button type="button" onClick={exportSources}>
        Baixar arquivos
      </button>{' '}
      ou rode <code>pnpm run dev</code> para salvar em content/cv.
    </div>
  );
}
