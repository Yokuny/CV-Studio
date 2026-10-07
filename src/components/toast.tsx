import { X } from 'lucide-react'
import { IconButton } from '@/components/icon-button'

export function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  if (!message) return null
  return (
    <div className="toast no-print" role="status">
      <span>{message}</span>
      <IconButton label="Fechar aviso" onClick={onClose}>
        <X />
      </IconButton>
    </div>
  )
}
