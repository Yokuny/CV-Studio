import { BookOpen, Code2, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'

export type PreviewMode = 'pdf' | 'markdown' | 'text'

const modes = [
  ['pdf', 'PDF', 'Visualizar currículo diagramado', FileText],
  ['markdown', 'Markdown', 'Visualizar Markdown renderizado', BookOpen],
  ['text', 'Texto', 'Visualizar código para edição', Code2],
] as const

export function ViewSwitch({
  value,
  onChange,
  disabled,
}: {
  value: PreviewMode
  onChange: (mode: PreviewMode) => void
  disabled: boolean
}) {
  return (
    <div className="preview-toolbar">
      <fieldset className="view-switch" aria-label="Tipo de visualização">
        {modes.map(([mode, label, title, Icon]) => (
          <Button
            key={mode}
            variant="ghost"
            size="sm"
            aria-label={`Visualizar ${label}`}
            aria-pressed={value === mode}
            title={title}
            disabled={disabled}
            onClick={() => onChange(mode)}
          >
            <Icon /> {label}
          </Button>
        ))}
      </fieldset>
    </div>
  )
}
