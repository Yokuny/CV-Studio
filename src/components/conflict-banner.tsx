import { Check, Download, RefreshCw } from 'lucide-react';
import { IconButton } from '@/components/icon-button';
import { downloadSources } from '@/lib/repository';
import { selectCurrent, useResumes } from '@/store/resumes';

export function ConflictBanner() {
  const current = useResumes(selectCurrent);
  const conflict = useResumes((s) => s.conflicts.includes(current.id));
  const reloadFromDisk = useResumes((s) => s.reloadFromDisk);
  const overwriteDisk = useResumes((s) => s.overwriteDisk);
  if (!conflict) return null;
  return (
    <div className="conflict-banner no-print" role="alert">
      <span
        className="conflict-status"
        title="O arquivo mudou enquanto você editava. Escolha como resolver o conflito."
      >
        <span className="conflict-status-dot" aria-hidden="true" />
        Salvamento pausado
      </span>
      <span className="sr-only">
        O arquivo desta versão mudou no disco enquanto você editava esta aba. Recarregue o arquivo, baixe suas
        alterações ou mantenha sua versão.
      </span>
      <div className="conflict-actions">
        <IconButton label="Recarregar do arquivo" onClick={() => void reloadFromDisk(current.id)}>
          <RefreshCw />
        </IconButton>
        <IconButton label="Baixar meu Markdown" onClick={() => downloadSources(current)}>
          <Download />
        </IconButton>
        <IconButton label="Manter minha versão" onClick={() => void overwriteDisk(current.id)}>
          <Check />
        </IconButton>
      </div>
    </div>
  );
}
