import { create } from 'zustand';
import { fitScale } from '@/lib/page';

export type PreviewMode = 'pdf' | 'markdown' | 'text';
export const defaultZoom = 0.85;
export const minZoom = 0.35;
export const maxZoom = 1.5;

export interface LayoutMetrics {
  paperHeight: number;
  availableWidth: number;
  headerHeight: number;
  actionHeight: number;
}

interface UiState {
  preview: PreviewMode;
  zoom: number;
  sidebarOpen: boolean;
  newVersionOpen: boolean;
  metrics: LayoutMetrics;
  setPreview: (preview: PreviewMode) => void;
  zoomBy: (delta: number) => void;
  resetZoom: () => void;
  toggleSidebar: () => void;
  setNewVersionOpen: (open: boolean) => void;
  setMetrics: (metrics: Partial<LayoutMetrics>) => void;
}

export const useUi = create<UiState>()((set) => ({
  preview: 'pdf',
  zoom: defaultZoom,
  sidebarOpen: true,
  newVersionOpen: false,
  metrics: { paperHeight: 1122, availableWidth: 900, headerHeight: 68, actionHeight: 68 },
  setPreview: (preview) => set({ preview }),
  zoomBy: (delta) => set((s) => ({ zoom: Math.min(maxZoom, Math.max(minZoom, s.zoom + delta)) })),
  resetZoom: () => set({ zoom: defaultZoom }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setNewVersionOpen: (newVersionOpen) => set({ newVersionOpen }),
  setMetrics: (metrics) =>
    set((s) =>
      (Object.keys(metrics) as (keyof LayoutMetrics)[]).every((k) => s.metrics[k] === metrics[k])
        ? s
        : { metrics: { ...s.metrics, ...metrics } },
    ),
}));

export const selectScale = (s: UiState) => fitScale(s.zoom, s.metrics.availableWidth);
