import { AlignCenter, AlignJustify, AlignLeft, AlignRight } from 'lucide-react'
import { IconButton } from '@/components/icon-button'
import { type BlockRange, findBlockAlignment } from '@/lib/model'
import { selectCurrent, useResumes } from '@/store/resumes'

const alignments = [
  ['left', 'Alinhar à esquerda', AlignLeft],
  ['center', 'Centralizar texto', AlignCenter],
  ['right', 'Alinhar à direita', AlignRight],
  ['justify', 'Justificar texto', AlignJustify],
] as const

export function AlignmentControls({ selectedBlocks }: { selectedBlocks: BlockRange[] }) {
  const { layout, markdown } = useResumes(selectCurrent)
  const alignBlocks = useResumes((s) => s.alignBlocks)
  const hasSelection = selectedBlocks.length > 0
  const alignmentOf = ({ start, end }: BlockRange) =>
    findBlockAlignment(layout, markdown, start, end)?.align ?? layout.textAlign ?? 'left'
  return (
    <fieldset className="selection-alignment" aria-label="Alinhar texto selecionado">
      {alignments.map(([align, label, Icon]) => (
        <IconButton
          key={align}
          label={label}
          title={hasSelection ? label : 'Selecione texto na página para alinhar'}
          disabled={!hasSelection}
          aria-pressed={
            hasSelection && selectedBlocks.every((block) => alignmentOf(block) === align)
          }
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => alignBlocks(selectedBlocks, align)}
        >
          <Icon />
        </IconButton>
      ))}
      <span className="toolbar-divider" />
    </fieldset>
  )
}
