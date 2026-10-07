import { LoaderCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { Version } from '@/lib/repository'

export function DeleteVersionDialog({
  version,
  writable,
  deleting,
  onCancel,
  onConfirm,
}: {
  version: Version | null
  writable: boolean
  deleting: boolean
  onCancel: () => void
  onConfirm: () => Promise<void>
}) {
  const [error, setError] = useState('')
  useEffect(() => {
    if (version) setError('')
  }, [version])
  async function confirm() {
    setError('')
    try {
      await onConfirm()
    } catch (failure) {
      setError((failure as Error).message)
    }
  }
  const blockWhileDeleting = (event: Event) => {
    if (deleting) event.preventDefault()
  }
  return (
    <Dialog
      open={version !== null}
      onOpenChange={(open) => {
        if (!open && !deleting) onCancel()
      }}
    >
      <DialogContent onEscapeKeyDown={blockWhileDeleting} onPointerDownOutside={blockWhileDeleting}>
        <DialogHeader>
          <DialogTitle>Fechar significa excluir</DialogTitle>
          <DialogDescription>
            Fechar a aba “{version?.name}” exclui esta versão e suas alterações em rascunho.
            {writable
              ? ' Os arquivos Markdown, layout e metadados também serão removidos de content/cv. Versões já registradas em commits continuam no histórico do Git.'
              : ' Nesta prévia, a exclusão vale apenas neste navegador. Os arquivos do projeto não serão removidos.'}
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" disabled={deleting} onClick={onCancel}>
            Cancelar
          </Button>
          <Button variant="destructive" disabled={deleting} onClick={confirm}>
            {deleting && <LoaderCircle className="animate-spin" />}Fechar e excluir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
