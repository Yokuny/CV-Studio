import { Plus } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { slugify } from '@/lib/model'

export function NewVersionDialog({
  open,
  onOpenChange,
  sourceName,
  onCreate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Name of the version being copied, or undefined when starting from scratch. */
  sourceName?: string
  /** Returns whether the version was created. */
  onCreate: (name: string) => boolean
}) {
  const [name, setName] = useState('')
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Uma versão, uma oportunidade</DialogTitle>
          <DialogDescription>
            {sourceName !== undefined
              ? `Comece com uma cópia de “${sourceName}”. O currículo original permanece disponível.`
              : 'Crie um currículo e escreva seu conteúdo em Markdown.'}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!onCreate(name)) return
            onOpenChange(false)
            setName('')
          }}
        >
          <Label htmlFor="version-name">Nome da versão</Label>
          <Input
            id="version-name"
            className="mt-2"
            autoFocus
            placeholder="Ex.: Backend Node.js — empresa"
            value={name}
            maxLength={120}
            onChange={(e) => setName(e.target.value)}
          />
          <p className="small-note mt-3">
            Arquivo: content/cv/{slugify(name) || 'nome-da-vaga'}.md
          </p>
          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              <Plus /> Criar versão
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
