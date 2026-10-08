import { Minus, Plus, ZoomIn } from 'lucide-react';
import { IconButton } from '@/components/icon-button';
import { maxZoom, minZoom, useUi } from '@/store/ui';

export function ZoomControls() {
  const zoom = useUi((s) => s.zoom);
  const zoomBy = useUi((s) => s.zoomBy);
  const resetZoom = useUi((s) => s.resetZoom);
  return (
    <>
      <IconButton label="Diminuir zoom" disabled={zoom <= minZoom} onClick={() => zoomBy(-0.1)}>
        <Minus />
      </IconButton>
      <IconButton label="Aumentar zoom" disabled={zoom >= maxZoom} onClick={() => zoomBy(0.1)}>
        <Plus />
      </IconButton>
      <IconButton label="Restaurar zoom" onClick={resetZoom}>
        <ZoomIn />
      </IconButton>
    </>
  );
}
