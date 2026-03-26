import { useRef, useState, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import { Toolbar } from './Toolbar';
import { WorkflowSidebar } from './WorkflowSidebar';
import { useWorkflowStore } from '../store/workflowStore';

// ── Persistence keys ──────────────────────────────────────────────────────────
const LS_CONFIG_W  = 'wap_panel_config_width';
const LS_LOG_H     = 'wap_panel_log_height';

// ── Size constraints ──────────────────────────────────────────────────────────
const CONFIG_DEFAULT = 288;   // ≈ w-72
const CONFIG_MIN     = 200;
const CONFIG_MAX     = 560;

const LOG_DEFAULT    = 220;
const LOG_MIN        = 100;
const LOG_MAX        = 500;

function readStoredNumber(key: string, fallback: number): number {
  try {
    const raw = localStorage.getItem(key);
    const n   = raw != null ? Number(raw) : NaN;
    return isNaN(n) ? fallback : n;
  } catch {
    return fallback;
  }
}

// ── Resize-handle hook ────────────────────────────────────────────────────────
/**
 * Returns a current size value and a mousedown handler that lets the user
 * drag to resize.  Saves the final size to localStorage on every mouse-move
 * so it survives refresh and logout.
 *
 * @param lsKey      localStorage key
 * @param defaultVal initial value when nothing is stored
 * @param min/max    clamp range
 * @param axis       'x' = horizontal handle (resize width)
 *                   'y' = vertical handle (resize height)
 * @param invert     true when dragging toward the origin *grows* the panel
 *                   (e.g. dragging the left edge of the right panel leftward
 *                   increases its width)
 */
function useResizablePanel(
  lsKey: string,
  defaultVal: number,
  min: number,
  max: number,
  axis: 'x' | 'y',
  invert: boolean,
) {
  const [size, setSize] = useState(() => readStoredNumber(lsKey, defaultVal));
  const sizeRef = useRef(size);
  sizeRef.current = size;

  const startDrag = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startCoord = axis === 'x' ? e.clientX : e.clientY;
      const startSize  = sizeRef.current;

      const onMove = (ev: MouseEvent) => {
        const coord = axis === 'x' ? ev.clientX : ev.clientY;
        const delta = invert
          ? startCoord - coord   // toward origin = grow
          : coord - startCoord;  // away from origin = grow
        const newSize = Math.max(min, Math.min(max, startSize + delta));
        setSize(newSize);
        try { localStorage.setItem(lsKey, String(Math.round(newSize))); } catch { /* ignore */ }
      };

      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup',   onUp);
        document.body.style.userSelect  = '';
        document.body.style.cursor      = '';
      };

      // Prevent text-selection and cursor flicker while dragging
      document.body.style.userSelect = 'none';
      document.body.style.cursor     = axis === 'x' ? 'col-resize' : 'row-resize';
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup',   onUp);
    },
    [lsKey, axis, invert, min, max],
  );

  return [size, startDrag] as const;
}

// ── Layout ────────────────────────────────────────────────────────────────────

interface LayoutProps {
  canvas:       ReactNode;
  configPanel:  ReactNode;
  executionLog: ReactNode;
}

export function Layout({ canvas, configPanel, executionLog }: LayoutProps) {
  const { logOpen } = useWorkflowStore();

  const [configWidth, startConfigDrag] = useResizablePanel(
    LS_CONFIG_W, CONFIG_DEFAULT, CONFIG_MIN, CONFIG_MAX,
    'x', true,   // drag the LEFT edge leftward to grow
  );

  const [logHeight, startLogDrag] = useResizablePanel(
    LS_LOG_H, LOG_DEFAULT, LOG_MIN, LOG_MAX,
    'y', true,   // drag the TOP edge upward to grow
  );

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-white overflow-hidden">
      <Toolbar />

      <div className="flex flex-1 min-h-0">
        <WorkflowSidebar />

        <div className="flex flex-1 min-w-0 flex-col">

          {/* ── Top row: canvas + config panel ─────────────────────── */}
          <div className="flex flex-1 min-h-0">

            {/* Canvas */}
            <div className="flex-1 min-w-0 relative">{canvas}</div>

            {/* Drag handle — vertical divider between canvas and config */}
            <div
              className="w-1 shrink-0 cursor-col-resize group relative"
              onMouseDown={startConfigDrag}
              title="Drag to resize"
            >
              {/* Visible stripe */}
              <div className="absolute inset-0 bg-slate-700 group-hover:bg-blue-500 transition-colors duration-150" />
              {/* Wider invisible hit-area */}
              <div className="absolute inset-y-0 -inset-x-1" />
            </div>

            {/* Config panel */}
            <div
              className="bg-slate-900 border-l border-slate-700 overflow-y-auto shrink-0"
              style={{ width: configWidth }}
            >
              {configPanel}
            </div>
          </div>

          {/* ── Bottom: execution log ──────────────────────────────── */}
          {logOpen && (
            <>
              {/* Drag handle — horizontal divider above the log */}
              <div
                className="h-1 shrink-0 cursor-row-resize group relative"
                onMouseDown={startLogDrag}
                title="Drag to resize"
              >
                <div className="absolute inset-0 bg-slate-700 group-hover:bg-blue-500 transition-colors duration-150" />
                <div className="absolute inset-x-0 -inset-y-1" />
              </div>

              <div
                className="border-t border-slate-700 shrink-0 overflow-hidden"
                style={{ height: logHeight }}
              >
                {executionLog}
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
