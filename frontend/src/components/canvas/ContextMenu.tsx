import { useEffect, useRef } from 'react';
import { Copy, Trash2 } from 'lucide-react';

export interface ContextMenuState {
  nodeId: string;
  nodeType: string;
  x: number;
  y: number;
}

interface ContextMenuProps {
  menu: ContextMenuState | null;
  onDuplicate: (nodeId: string) => void;
  onDelete: (nodeId: string) => void;
  onClose: () => void;
}

export function ContextMenu({ menu, onDuplicate, onDelete, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menu, onClose]);

  if (!menu) return null;

  const item =
    'flex items-center gap-2.5 w-full px-3 py-2 text-sm rounded-lg text-left transition-colors';

  return (
    <div
      ref={ref}
      className="fixed z-[9999] min-w-[160px] py-1 rounded-xl shadow-2xl border
                 bg-white dark:bg-slate-900
                 border-slate-200 dark:border-slate-700
                 text-slate-700 dark:text-slate-200"
      style={{ left: menu.x, top: menu.y }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <button
        className={`${item} hover:bg-slate-100 dark:hover:bg-white/10`}
        onClick={() => { onDuplicate(menu.nodeId); onClose(); }}
      >
        <Copy className="w-4 h-4 text-slate-400 dark:text-slate-500" />
        Duplicate
      </button>
      <div className="my-1 h-px bg-slate-100 dark:bg-white/10 mx-2" />
      <button
        className={`${item} hover:bg-red-50 dark:hover:bg-red-500/15 text-red-600 dark:text-red-400`}
        onClick={() => { onDelete(menu.nodeId); onClose(); }}
      >
        <Trash2 className="w-4 h-4" />
        Delete
      </button>
    </div>
  );
}
