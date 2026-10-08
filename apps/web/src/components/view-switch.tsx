import { BookOpen, BriefcaseBusiness, Code2, FileText, MessageSquareText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { selectHasVersion, useResumes } from '@/store/resumes';
import { type PreviewMode, useUi } from '@/store/ui';

const modes = [
  ['pdf', 'PDF', 'Visualizar currículo diagramado', FileText],
  ['markdown', 'Markdown', 'Visualizar Markdown renderizado', BookOpen],
  ['text', 'Texto', 'Visualizar código para edição', Code2],
  ['pitch', 'Pitch', 'Editar o pitch enviado no email desta versão', MessageSquareText],
  ['jobs', 'Vagas', 'Vagas cadastradas e envio por email', BriefcaseBusiness],
] as const;

export function ViewSwitch() {
  const preview = useUi((s) => s.preview);
  const setPreview = useUi((s) => s.setPreview);
  const noVersion = useResumes((s) => !s.ready || !selectHasVersion(s));
  // Jobs and email live in the local API; the static build has no server to keep them.
  const noServer = useResumes((s) => !s.ready || !s.writable);
  const disabled = (mode: PreviewMode) => (mode === 'jobs' ? noServer : noVersion);
  return (
    <div className="preview-toolbar">
      <fieldset className="view-switch" aria-label="Tipo de visualização">
        {modes.map(([mode, label, title, Icon]) => (
          <Button
            key={mode}
            variant="ghost"
            size="sm"
            aria-label={`Visualizar ${label}`}
            aria-pressed={preview === mode}
            title={mode === 'jobs' && noServer ? 'Disponível com pnpm run dev (servidor local)' : title}
            disabled={disabled(mode)}
            onClick={() => setPreview(mode)}
          >
            <Icon /> {label}
          </Button>
        ))}
      </fieldset>
    </div>
  );
}
