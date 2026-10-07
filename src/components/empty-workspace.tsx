import { FileText, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function EmptyWorkspace({ onNew }: { onNew: () => void }) {
  return (
    <div className="empty-workspace">
      <FileText size={32} />
      <h1>Nenhuma versão aberta</h1>
      <p>Crie uma nova versão para começar seu currículo.</p>
      <Button onClick={onNew}>
        <Plus /> Nova Versão
      </Button>
    </div>
  )
}
