import { BookOpen, Code2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { selectHasVersion, useResumes } from '@/store/resumes';
import { useUi } from '@/store/ui';

const modes = [
  ['pdf', 'PDF', 'Visualizar currículo diagramado', FileText],
  ['markdown', 'Markdown', 'Visualizar Markdown renderizado', BookOpen],
  ['text', 'Texto', 'Visualizar código para edição', Code2],
] as const;

export function ViewSwitch() {
  const preview = useUi((s) => s.preview);
  const setPreview = useUi((s) => s.setPreview);
  const disabled = useResumes((s) => !s.ready || !selectHasVersion(s));
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
            title={title}
            disabled={disabled}
            onClick={() => setPreview(mode)}
          >
            <Icon /> {label}
          </Button>
        ))}
      </fieldset>
    </div>
  );
}
