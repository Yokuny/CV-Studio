import { FileText, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useResumes } from '@/store/resumes';
import { useUi } from '@/store/ui';

export function EmptyWorkspace() {
  const setNewVersionOpen = useUi((s) => s.setNewVersionOpen);
  const writable = useResumes((s) => s.writable);
  return (
    <div className="empty-workspace">
      <FileText size={32} />
      <h1>Nenhuma versão aberta</h1>
      <p>
        {writable
          ? 'Crie seu currículo base (ou rode pnpm cv init). Seus arquivos ficam só neste computador.'
          : 'Crie uma nova versão para começar seu currículo.'}
      </p>
      <Button onClick={() => setNewVersionOpen(true)}>
        <Plus /> Nova Versão
      </Button>
    </div>
  );
}
