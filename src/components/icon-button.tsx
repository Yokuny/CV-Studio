import type { ComponentProps } from 'react';
import { Button } from '@/components/ui/button';

/** Ghost button whose only visible content is an icon; `label` names it for assistive tech. */
export function IconButton({
  label,
  title = label,
  variant = 'ghost',
  size = 'icon-xs',
  ...props
}: ComponentProps<typeof Button> & { label: string }) {
  return <Button variant={variant} size={size} aria-label={label} title={title} {...props} />;
}
