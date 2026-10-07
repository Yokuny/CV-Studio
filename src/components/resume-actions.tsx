import { ArrowDownToLine, ArrowUpFromLine, LoaderCircle, Save } from 'lucide-react'
import { type ComponentProps, type ReactNode, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'

function ActionButton({
  label,
  icon,
  ...props
}: ComponentProps<typeof Button> & { label: string; icon: ReactNode }) {
  return (
    <Button variant="ghost" size="sm" aria-label={label} {...props}>
      {icon}
      <span className="button-label">{label}</span>
    </Button>
  )
}

export function ResumeActions({
  disabled,
  canImport,
  canSave,
  saving,
  onImport,
  onDownload,
  onSave,
}: {
  disabled: boolean
  canImport: boolean
  canSave: boolean
  saving: boolean
  onImport: (file?: File) => void
  onDownload: () => void
  onSave: () => void
}) {
  const importRef = useRef<HTMLInputElement>(null)
  return (
    <div className="header-actions">
      <ButtonGroup className="action-group" aria-label="Resume actions">
        <ActionButton
          label="Import"
          title="Import Markdown"
          icon={<ArrowUpFromLine />}
          onClick={() => importRef.current?.click()}
          disabled={disabled || !canImport}
        />
        <ActionButton
          label="Download"
          title="Download source files"
          icon={<ArrowDownToLine />}
          onClick={onDownload}
          disabled={disabled}
        />
        <ActionButton
          label="Save"
          title="Save version"
          icon={
            <span className="inline-flex">
              {saving ? <LoaderCircle className="animate-spin" /> : <Save />}
            </span>
          }
          onClick={onSave}
          disabled={disabled || !canSave}
        />
        <ActionButton
          className="ml-1 rounded-md! shadow-none!"
          variant="default"
          label="Export"
          title="Export PDF"
          icon={<ArrowDownToLine />}
          onClick={() => window.print()}
          disabled={disabled}
        />
      </ButtonGroup>
      <input
        ref={importRef}
        type="file"
        accept=".md,text/markdown"
        className="hidden"
        aria-label="Importar arquivo Markdown"
        onChange={(e) => {
          onImport(e.target.files?.[0])
          e.target.value = ''
        }}
      />
    </div>
  )
}
