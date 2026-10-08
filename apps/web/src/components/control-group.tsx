import type { ReactNode } from 'react';

export function ControlGroup({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <fieldset className="control-group">
      <legend>
        {icon} {title}
      </legend>
      {children}
    </fieldset>
  );
}
