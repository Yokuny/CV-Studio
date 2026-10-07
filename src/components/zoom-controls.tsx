import { Minus, Plus, ZoomIn } from 'lucide-react'
import { IconButton } from '@/components/icon-button'

export const defaultZoom = 0.85
const minZoom = 0.35
const maxZoom = 1.5

export function ZoomControls({
  zoom,
  onChange,
}: {
  zoom: number
  onChange: (update: (zoom: number) => number) => void
}) {
  return (
    <>
      <IconButton
        label="Diminuir zoom"
        disabled={zoom <= minZoom}
        onClick={() => onChange((z) => Math.max(minZoom, z - 0.1))}
      >
        <Minus />
      </IconButton>
      <IconButton
        label="Aumentar zoom"
        disabled={zoom >= maxZoom}
        onClick={() => onChange((z) => Math.min(maxZoom, z + 0.1))}
      >
        <Plus />
      </IconButton>
      <IconButton label="Restaurar zoom" onClick={() => onChange(() => defaultZoom)}>
        <ZoomIn />
      </IconButton>
    </>
  )
}
