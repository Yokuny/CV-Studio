import { ArrowDownToLine, ArrowUpFromLine, LoaderCircle, Save } from 'lucide-react'
import { type ComponentProps, type ReactNode, useRef } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import { selectDeleting, selectDirty, selectHasVersion, useResumes } from '@/store/resumes'

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

export function ResumeActions() {
  const { saving, importMarkdown, exportSources, save } = useResumes(
    useShallow(({ saving, importMarkdown, exportSources, save }) => ({
      saving,
      importMarkdown,
      exportSources,
      save,
    })),
  )
  const disabled = useResumes((s) => !s.ready || !selectHasVersion(s))
  const deleting = useResumes(selectDeleting)
  const canSave = useResumes((s) => s.writable && selectDirty(s))
  const importRef = useRef<HTMLInputElement>(null)
  return (
    <div className="header-actions">
      <ButtonGroup className="action-group" aria-label="Resume actions">
        <ActionButton
          label="Import"
          title="Import Markdown"
          icon={<ArrowUpFromLine />}
          onClick={() => importRef.current?.click()}
          disabled={disabled || deleting}
        />
        <ActionButton
          label="Download"
          title="Download source files"
          icon={<ArrowDownToLine />}
          onClick={exportSources}
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
          onClick={save}
          disabled={disabled || !canSave || saving || deleting}
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
          void importMarkdown(e.target.files?.[0])
          e.target.value = ''
        }}
      />
    </div>
  )
}
