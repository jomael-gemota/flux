import { useRef, useState, useCallback } from 'react';

function readStoredNumber(key: string, fallback: number): number {
  try {
    const raw = localStorage.getItem(key);
    const n   = raw != null ? Number(raw) : NaN;
    return isNaN(n) ? fallback : n;
  } catch {
    return fallback;
  }
}

/**
 * Returns [size, startDrag].
 * Drag the handle to resize; size is clamped to [min, max] and persisted
 * to localStorage on every mouse-move.
 *
 * @param lsKey      localStorage key
 * @param defaultVal initial value when nothing is stored
 * @param min/max    clamp range
 * @param axis       'x' → resize width   'y' → resize height
 * @param invert     true when dragging toward the origin grows the panel
 */
export function useResizablePanel(
  lsKey: string,
  defaultVal: number,
  min: number,
  max: number,
  axis: 'x' | 'y',
  invert: boolean,
): [number, (e: React.MouseEvent) => void] {
  const [size, setSize] = useState(() => readStoredNumber(lsKey, defaultVal));
  const sizeRef = useRef(size);
  sizeRef.current = size;

  const startDrag = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startCoord = axis === 'x' ? e.clientX : e.clientY;
      const startSize  = sizeRef.current;

      const onMove = (ev: MouseEvent) => {
        const coord   = axis === 'x' ? ev.clientX : ev.clientY;
        const delta   = invert ? startCoord - coord : coord - startCoord;
        const newSize = Math.max(min, Math.min(max, startSize + delta));
        setSize(newSize);
        try { localStorage.setItem(lsKey, String(Math.round(newSize))); } catch { /* ignore */ }
      };

      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup',   onUp);
        document.body.style.userSelect = '';
        document.body.style.cursor     = '';
      };

      document.body.style.userSelect = 'none';
      document.body.style.cursor     = axis === 'x' ? 'col-resize' : 'row-resize';
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup',   onUp);
    },
    [lsKey, axis, invert, min, max],
  );

  return [size, startDrag];
}
