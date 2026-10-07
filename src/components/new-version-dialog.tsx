import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { slugify } from '@/lib/model';
import { selectCurrent, selectHasVersion, useResumes } from '@/store/resumes';
import { useUi } from '@/store/ui';

export function NewVersionDialog() {
  const open = useUi((s) => s.newVersionOpen);
  const onOpenChange = useUi((s) => s.setNewVersionOpen);
  const sourceName = useResumes((s) => (selectHasVersion(s) ? selectCurrent(s).name : undefined));
  const onCreate = useResumes((s) => s.create);
  const writable = useResumes((s) => s.writable);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
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
          onSubmit={async (e) => {
            e.preventDefault();
            setCreating(true);
            const created = await onCreate(name);
            setCreating(false);
            if (!created) return;
            onOpenChange(false);
            setName('');
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
            {writable ? 'Grava agora' : 'Arquivo ao baixar'}: content/cv/{slugify(name) || 'nome-da-vaga'}.md
          </p>
          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!name.trim() || creating}>
              <Plus /> Criar versão
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
