import { ChevronDown } from 'lucide-react'
import { type FontFamily, fonts } from '@/lib/model'

/** Font picker; pass `inheritLabel` to offer an empty option that keeps the inherited font. */
export function FontSelect<T extends FontFamily | ''>({
  id,
  value,
  onChange,
  inheritLabel,
  'aria-label': ariaLabel,
}: {
  id: string
  value: T
  onChange: (value: T) => void
  inheritLabel?: string
  'aria-label'?: string
}) {
  return (
    <div className="select-wrap">
      <select
        id={id}
        aria-label={ariaLabel}
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
      >
        {inheritLabel !== undefined && <option value="">{inheritLabel}</option>}
        {fonts.map((font) => (
          <option key={font} value={font}>
            {font}
          </option>
        ))}
      </select>
      <ChevronDown size={14} />
    </div>
  )
}
