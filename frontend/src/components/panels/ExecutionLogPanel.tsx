import { useState } from 'react';
import { ChevronDown, ChevronUp, CheckCircle2, XCircle, Clock, Loader2, X } from 'lucide-react';
import { useWorkflowStore } from '../../store/workflowStore';
import { useExecutionList } from '../../hooks/useExecutions';
import type { ExecutionSummary, NodeResult } from '../../types/workflow';

const STATUS_ICON: Record<string, React.ReactNode> = {
  success: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />,
  failure: <XCircle className="w-3.5 h-3.5 text-red-400" />,
  partial: <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />,
  pending: <Clock className="w-3.5 h-3.5 text-slate-400" />,
  running: <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />,
};

const STATUS_BADGE: Record<string, string> = {
  success: 'bg-emerald-500/20 text-emerald-300',
  failure: 'bg-red-500/20 text-red-300',
  partial: 'bg-amber-500/20 text-amber-300',
  pending: 'bg-slate-600/40 text-slate-400',
  running: 'bg-blue-500/20 text-blue-300',
};

export function ExecutionLogPanel() {
  const { activeWorkflow, setLogOpen, lastExecutionId } = useWorkflowStore();
  const { data: executions, isLoading } = useExecutionList(
    activeWorkflow?.id ?? null
  );
  const [expandedId, setExpandedId] = useState<string | null>(lastExecutionId);

  function toggle(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  return (
    <div className="flex flex-col h-full bg-slate-900">
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700 shrink-0">
        <span className="text-xs font-semibold text-slate-300">Execution Log</span>
        <button
          onClick={() => setLogOpen(false)}
          className="text-slate-500 hover:text-white transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="flex justify-center py-4">
            <Loader2 className="w-4 h-4 text-slate-500 animate-spin" />
          </div>
        )}

        {!isLoading && !executions?.length && (
          <p className="text-slate-500 text-xs text-center py-4">
            No executions yet
          </p>
        )}

        {(executions ?? []).map((exec) => (
          <ExecutionRow
            key={exec.executionId}
            exec={exec}
            expanded={expandedId === exec.executionId}
            onToggle={() => toggle(exec.executionId)}
          />
        ))}
      </div>
    </div>
  );
}

function ExecutionRow({
  exec,
  expanded,
  onToggle,
}: {
  exec: ExecutionSummary;
  expanded: boolean;
  onToggle: () => void;
}) {
  const started = new Date(exec.startedAt);
  const duration =
    exec.completedAt
      ? Math.round(
          (new Date(exec.completedAt).getTime() - started.getTime())
        )
      : null;

  return (
    <div className="border-b border-slate-800">
      <button
        className="w-full flex items-center gap-3 px-4 py-2 hover:bg-slate-800/50 transition-colors text-left"
        onClick={onToggle}
      >
        {STATUS_ICON[exec.status]}
        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-300 truncate font-mono">
            {exec.executionId.slice(0, 8)}…
          </p>
          <p className="text-[10px] text-slate-500">
            {started.toLocaleTimeString()}
            {duration != null && ` · ${duration}ms`}
          </p>
        </div>
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${STATUS_BADGE[exec.status] ?? ''}`}
        >
          {exec.status}
        </span>
        {expanded ? (
          <ChevronUp className="w-3 h-3 text-slate-500 shrink-0" />
        ) : (
          <ChevronDown className="w-3 h-3 text-slate-500 shrink-0" />
        )}
      </button>

      {expanded && exec.results.length > 0 && (
        <div className="px-4 pb-3 space-y-1">
          {(exec.results as NodeResult[]).map((r) => (
            <NodeResultRow key={r.nodeId} result={r} />
          ))}
        </div>
      )}

      {expanded && exec.results.length === 0 && (
        <p className="px-4 pb-3 text-[10px] text-slate-600">
          {exec.status === 'pending' || exec.status === 'running'
            ? 'Waiting for results…'
            : 'No results recorded.'}
        </p>
      )}
    </div>
  );
}

function NodeResultRow({ result }: { result: NodeResult }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="bg-slate-800 rounded text-[10px] overflow-hidden cursor-pointer"
      onClick={() => setOpen((p) => !p)}
    >
      <div className="flex items-center gap-2 px-2 py-1">
        {result.status === 'success' ? (
          <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
        ) : result.status === 'failure' ? (
          <XCircle className="w-3 h-3 text-red-400 shrink-0" />
        ) : (
          <Clock className="w-3 h-3 text-slate-400 shrink-0" />
        )}
        <span className="font-mono text-slate-300 flex-1">{result.nodeId}</span>
        <span className="text-slate-500">{result.durationMs}ms</span>
      </div>
      {open && (
        <div className="border-t border-slate-700 px-2 py-1.5">
          {result.error && (
            <p className="text-red-400 mb-1">{result.error}</p>
          )}
          {result.output != null && (
            <pre className="text-slate-400 whitespace-pre-wrap break-all max-h-24 overflow-y-auto">
              {JSON.stringify(result.output, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
