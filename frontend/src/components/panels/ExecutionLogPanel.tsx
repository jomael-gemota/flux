import { useState, useMemo } from 'react';
import {
  ChevronDown, ChevronUp, CheckCircle2, XCircle,
  Clock, Loader2, X, ChevronRight,
} from 'lucide-react';
import { useWorkflowStore } from '../../store/workflowStore';
import { useExecutionLog } from '../../hooks/useExecutions';
import type { ExecutionSummary, NodeResult } from '../../types/workflow';

const PAGE_SIZE = 8;

// ── Status helpers ────────────────────────────────────────────────────────────

const STATUS_ICON: Record<string, React.ReactNode> = {
  success: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />,
  failure: <XCircle       className="w-3.5 h-3.5 text-red-400" />,
  partial: <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />,
  pending: <Clock         className="w-3.5 h-3.5 text-slate-400" />,
  running: <Loader2       className="w-3.5 h-3.5 text-blue-400 animate-spin" />,
};

const STATUS_BADGE: Record<string, string> = {
  success: 'bg-emerald-500/20 text-emerald-300',
  failure: 'bg-red-500/20 text-red-300',
  partial: 'bg-amber-500/20 text-amber-300',
  pending: 'bg-slate-600/40 text-slate-400',
  running: 'bg-blue-500/20 text-blue-300',
};

const NODE_STATUS_ICON: Record<string, React.ReactNode> = {
  success: <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />,
  failure: <XCircle       className="w-3 h-3 text-red-400 shrink-0" />,
  skipped: <Clock         className="w-3 h-3 text-slate-500 shrink-0" />,
};

// ── Main panel ────────────────────────────────────────────────────────────────

export function ExecutionLogPanel() {
  const { activeWorkflow, setLogOpen, lastExecutionId } = useWorkflowStore();

  // Node-ID → name map built from the active workflow's node list
  const nodeNameMap = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const n of activeWorkflow?.nodes ?? []) {
      map[n.id] = n.name;
    }
    return map;
  }, [activeWorkflow?.nodes]);

  // Fetch limit grows by PAGE_SIZE each time the user clicks "Load more"
  const [fetchLimit, setFetchLimit] = useState(PAGE_SIZE);
  const { data: paginatedData, isLoading } = useExecutionLog(
    activeWorkflow?.id ?? null,
    fetchLimit
  );

  const executions = paginatedData?.data ?? [];
  const hasMore    = paginatedData?.pagination.hasMore ?? false;

  const [expandedId, setExpandedId] = useState<string | null>(lastExecutionId);

  function toggle(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  return (
    <div className="flex flex-col h-full bg-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700 shrink-0">
        <span className="text-xs font-semibold text-slate-300">
          Execution Log
          {executions.length > 0 && (
            <span className="ml-2 text-slate-500 font-normal">
              {executions.length}{hasMore ? '+' : ''} run{executions.length !== 1 ? 's' : ''}
            </span>
          )}
        </span>
        <button
          onClick={() => setLogOpen(false)}
          className="text-slate-500 hover:text-white transition-colors"
          title="Close"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {isLoading && (
          <div className="flex justify-center py-4">
            <Loader2 className="w-4 h-4 text-slate-500 animate-spin" />
          </div>
        )}

        {!isLoading && executions.length === 0 && (
          <p className="text-slate-500 text-xs text-center py-6">
            No executions yet
          </p>
        )}

        {executions.map((exec) => (
          <ExecutionRow
            key={exec.executionId}
            exec={exec}
            expanded={expandedId === exec.executionId}
            onToggle={() => toggle(exec.executionId)}
            nodeNameMap={nodeNameMap}
          />
        ))}

        {/* Load more */}
        {hasMore && (
          <button
            className="w-full py-2 text-[11px] text-slate-400 hover:text-blue-400 hover:bg-slate-800/50 transition-colors border-t border-slate-800"
            onClick={() => setFetchLimit((prev) => prev + PAGE_SIZE)}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="w-3 h-3 animate-spin mx-auto" />
            ) : (
              'Load more'
            )}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Execution row ─────────────────────────────────────────────────────────────

function ExecutionRow({
  exec,
  expanded,
  onToggle,
  nodeNameMap,
}: {
  exec: ExecutionSummary;
  expanded: boolean;
  onToggle: () => void;
  nodeNameMap: Record<string, string>;
}) {
  const started  = new Date(exec.startedAt);
  const duration =
    exec.completedAt
      ? Math.round(new Date(exec.completedAt).getTime() - started.getTime())
      : null;

  return (
    <div className="border-b border-slate-800">
      <button
        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-800/50 transition-colors text-left"
        onClick={onToggle}
      >
        {STATUS_ICON[exec.status]}

        <div className="flex-1 min-w-0">
          {/* Date + time */}
          <p className="text-[11px] text-slate-300 font-medium">
            {started.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            {' '}
            <span className="text-slate-400 font-normal">
              {started.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </p>
          {/* ID + duration */}
          <p className="text-[10px] text-slate-600 font-mono">
            {exec.executionId.slice(0, 8)}
            {duration != null && (
              <span className="text-slate-500 not-italic ml-1">· {duration} ms</span>
            )}
          </p>
        </div>

        <span
          className={`text-[10px] px-1.5 py-0.5 rounded font-semibold shrink-0 ${STATUS_BADGE[exec.status] ?? ''}`}
        >
          {exec.status}
        </span>

        {expanded
          ? <ChevronUp   className="w-3 h-3 text-slate-500 shrink-0" />
          : <ChevronDown className="w-3 h-3 text-slate-500 shrink-0" />
        }
      </button>

      {expanded && (
        <div className="px-3 pb-3">
          {exec.results.length === 0 ? (
            <p className="text-[10px] text-slate-600 px-1">
              {exec.status === 'pending' || exec.status === 'running'
                ? 'Waiting for results…'
                : 'No results recorded.'}
            </p>
          ) : (
            <div className="space-y-1">
              {(exec.results as NodeResult[]).map((r) => (
                <NodeResultRow
                  key={r.nodeId}
                  result={r}
                  nodeName={nodeNameMap[r.nodeId]}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Node result row ───────────────────────────────────────────────────────────

function NodeResultRow({
  result,
  nodeName,
}: {
  result: NodeResult;
  nodeName: string | undefined;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="bg-slate-800/80 rounded text-[10px] overflow-hidden cursor-pointer border border-slate-700/50 hover:border-slate-600 transition-colors"
      onClick={() => setOpen((p) => !p)}
    >
      <div className="flex items-center gap-2 px-2.5 py-1.5">
        {NODE_STATUS_ICON[result.status] ?? <Clock className="w-3 h-3 text-slate-400 shrink-0" />}

        {/* Node name (primary) + ID (secondary) */}
        <span className="flex-1 min-w-0">
          <span className="text-slate-200 font-medium truncate block">
            {nodeName ?? result.nodeId}
          </span>
          {nodeName && (
            <span className="text-slate-600 font-mono truncate block">
              {result.nodeId}
            </span>
          )}
        </span>

        <span className="text-slate-500 shrink-0">{result.durationMs} ms</span>
        <ChevronRight
          className={`w-3 h-3 text-slate-600 shrink-0 transition-transform ${open ? 'rotate-90' : ''}`}
        />
      </div>

      {open && (
        <div className="border-t border-slate-700/60 px-2.5 py-2 space-y-1">
          {result.error && (
            <p className="text-red-400 font-medium">{result.error}</p>
          )}
          {result.output != null && (
            <pre className="text-slate-400 whitespace-pre-wrap break-all max-h-32 overflow-y-auto leading-relaxed">
              {JSON.stringify(result.output, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
