import { FileText, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUi } from '@/store/ui';

export function EmptyWorkspace() {
  const setNewVersionOpen = useUi((s) => s.setNewVersionOpen);
  return (
    <div className="empty-workspace">
      <FileText size={32} />
      <h1>Nenhuma versão aberta</h1>
      <p>Crie uma nova versão para começar seu currículo.</p>
      <Button onClick={() => setNewVersionOpen(true)}>
        <Plus /> Nova Versão
      </Button>
    </div>
  );
}
