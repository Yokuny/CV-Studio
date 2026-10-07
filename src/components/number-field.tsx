import { Minus, Plus } from 'lucide-react'
import { type PointerEvent, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface NumberFieldProps {
  id: string
  label: string
  value: number
  min: number
  max: number
  step: number
  unit: string
  onChange: (value: number) => void
}

export function NumberField({
  id,
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: NumberFieldProps) {
  const [draft, setDraft] = useState(String(value))
  const [scrubbing, setScrubbing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const gesture = useRef<{ pointerId: number; x: number; value: number; moved: boolean } | null>(
    null,
  )

  useEffect(() => {
    setDraft(String(value))
  }, [value])
  useEffect(
    () => () => {
      if (gesture.current?.moved) document.body.classList.remove('is-scrubbing')
    },
    [],
  )

  function normalize(number: number) {
    return Number(
      Math.min(max, Math.max(min, min + Math.round((number - min) / step) * step)).toFixed(4),
    )
  }
  function apply(number: number) {
    const next = normalize(number)
    setDraft(String(next))
    onChange(next)
  }
  function commit(text: string) {
    const number = text.trim() ? Number(text) : NaN
    apply(Number.isFinite(number) ? number : value)
  }
  function pointerDown(event: PointerEvent<HTMLInputElement>) {
    // A click enters text editing; dragging an unfocused value starts scrubbing.
    // Focused inputs keep native caret/selection, and touch keeps vertical scrolling.
    if (
      event.button !== 0 ||
      event.pointerType !== 'mouse' ||
      document.activeElement === event.currentTarget
    )
      return
    event.preventDefault()
    gesture.current = { pointerId: event.pointerId, x: event.clientX, value, moved: false }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  function pointerMove(event: PointerEvent<HTMLInputElement>) {
    const drag = gesture.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const distance = event.clientX - drag.x
    if (!drag.moved && Math.abs(distance) < 4) return
    if (!drag.moved) {
      drag.moved = true
      setScrubbing(true)
      document.body.classList.add('is-scrubbing')
    }
    apply(drag.value + Math.round(distance / (event.shiftKey ? 32 : 8)) * step)
  }
  function finish(event: PointerEvent<HTMLInputElement>, cancelled = false) {
    const drag = gesture.current
    if (!drag || drag.pointerId !== event.pointerId) return
    gesture.current = null
    setScrubbing(false)
    document.body.classList.remove('is-scrubbing')
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId)
    if (cancelled && drag.moved) apply(drag.value)
    if (!cancelled && !drag.moved) {
      event.currentTarget.focus()
      event.currentTarget.select()
    }
  }

  return (
    <div className="token-control">
      <Label htmlFor={id}>{label}</Label>
      <div className={`number-field ${scrubbing ? 'scrubbing' : ''}`}>
        <Button
          variant="ghost"
          size="icon-xs"
          className="number-step"
          aria-label={`Diminuir ${label.toLowerCase()}`}
          disabled={value <= min}
          onClick={() => apply(value - step)}
        >
          <Minus />
        </Button>
        <Input
          ref={inputRef}
          id={id}
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          value={draft}
          className="number-value"
          title="Arraste para ajustar. Clique para digitar. Shift + arraste para ajustar mais devagar."
          aria-describedby={`${id}-unit`}
          onChange={(event) => {
            setDraft(event.target.value)
            const next = event.target.valueAsNumber
            if (Number.isFinite(next) && next >= min && next <= max) onChange(next)
          }}
          onBlur={(event) => commit(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
              event.preventDefault()
              const parsed = Number(event.currentTarget.value)
              apply(
                (event.currentTarget.value && Number.isFinite(parsed) ? parsed : value) +
                  (event.key === 'ArrowUp' ? step : -step),
              )
            } else if (event.key === 'Enter') {
              event.currentTarget.blur()
            } else if (event.key === 'Escape') {
              event.currentTarget.value = String(value)
              event.currentTarget.blur()
            }
          }}
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={(event) => finish(event)}
          onPointerCancel={(event) => finish(event, true)}
          onLostPointerCapture={(event) => finish(event, true)}
        />
        <span id={`${id}-unit`} className="number-unit">
          {unit}
        </span>
        <Button
          variant="ghost"
          size="icon-xs"
          className="number-step"
          aria-label={`Aumentar ${label.toLowerCase()}`}
          disabled={value >= max}
          onClick={() => apply(value + step)}
        >
          <Plus />
        </Button>
      </div>
    </div>
  )
}
