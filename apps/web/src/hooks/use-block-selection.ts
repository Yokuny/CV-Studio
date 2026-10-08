import { type RefObject, useEffect, useState } from 'react';
import type { BlockRange } from '@/lib/model';

/** Tracks which Markdown blocks of the rendered paper intersect the text selection. */
export function useBlockSelection(
  paperRef: RefObject<HTMLElement | null>,
  versionId: string,
  markdownLength: number,
  enabled: boolean,
) {
  const [selectedBlocks, setSelectedBlocks] = useState<BlockRange[]>([]);
  useEffect(() => {
    setSelectedBlocks([]);
    const captureSelection = () => {
      const selection = window.getSelection();
      const paper = paperRef.current;
      if (
        !enabled ||
        !paper ||
        paper.dataset.version !== versionId ||
        !selection?.rangeCount ||
        selection.isCollapsed ||
        !paper.contains(selection.anchorNode) ||
        !paper.contains(selection.focusNode)
      ) {
        setSelectedBlocks([]);
        return;
      }
      const range = selection.getRangeAt(0);
      const blocks = Array.from(paper.querySelectorAll<HTMLElement>('[data-block-start]')).filter(
        (element) => range.intersectsNode(element) && Number(element.dataset.blockEnd) <= markdownLength,
      );
      setSelectedBlocks(
        blocks
          .filter((element) => !blocks.some((child) => child !== element && element.contains(child)))
          .map((element) => ({
            start: Number(element.dataset.blockStart),
            end: Number(element.dataset.blockEnd),
          })),
      );
    };
    document.addEventListener('selectionchange', captureSelection);
    return () => document.removeEventListener('selectionchange', captureSelection);
  }, [paperRef, versionId, markdownLength, enabled]);
  return selectedBlocks;
}
