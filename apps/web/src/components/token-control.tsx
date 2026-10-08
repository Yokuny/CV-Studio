import { NumberField } from '@/components/number-field';
import { type Layout, layoutRanges } from '@/lib/model';

export type LayoutToken = keyof typeof layoutRanges;

export function TokenControl({
  name,
  token,
  unit,
  layout,
  onChange,
}: {
  name: string;
  token: LayoutToken;
  unit: string;
  layout: Layout;
  onChange: (token: LayoutToken, value: number) => void;
}) {
  const [min, max, step] = layoutRanges[token];
  return (
    <NumberField
      id={`token-${token}`}
      label={name}
      value={layout[token]}
      min={min}
      max={max}
      step={step}
      unit={unit}
      onChange={(value) => onChange(token, value)}
    />
  );
}
