import type { ReactNode } from 'react'
import { Label } from '@/components/ui/label'

/** Labelled color input; `adornment` renders before the swatch (hex value, reset button…). */
export function ColorField({
  id,
  label,
  value,
  onChange,
  adornment,
  title,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  adornment?: ReactNode
  title?: string
}) {
  return (
    <div className="color-control">
      <Label htmlFor={id}>{label}</Label>
      <div>
        {adornment}
        <input
          id={id}
          type="color"
          value={value}
          title={title}
          aria-label={`Cor de ${label.toLowerCase()}`}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    </div>
  )
}
