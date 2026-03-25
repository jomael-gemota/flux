import { Handle, Position } from '@xyflow/react';
import type { ReactNode } from 'react';

const TYPE_COLORS: Record<string, string> = {
  trigger: 'bg-purple-500',
  http: 'bg-blue-500',
  llm: 'bg-emerald-500',
  condition: 'bg-amber-500',
  switch: 'bg-orange-500',
  transform: 'bg-cyan-500',
  output: 'bg-rose-500',
};

interface BaseNodeProps {
  nodeType: string;
  label: string;
  isEntry?: boolean;
  isSelected?: boolean;
  children?: ReactNode;
  handles?: {
    inputs?: Array<{ id?: string; label?: string }>;
    outputs?: Array<{ id?: string; label?: string }>;
  };
}

export function BaseNode({
  nodeType,
  label,
  isEntry,
  isSelected,
  children,
  handles,
}: BaseNodeProps) {
  const color = TYPE_COLORS[nodeType] ?? 'bg-slate-500';
  const inputs = handles?.inputs ?? [{}];
  const outputs = handles?.outputs ?? [{}];

  return (
    <div
      className={`rounded-lg shadow-md bg-white border-2 min-w-[180px] ${
        isSelected ? 'border-blue-500 shadow-blue-200 shadow-lg' : 'border-slate-200'
      }`}
    >
      {/* Header */}
      <div className={`${color} rounded-t-md px-3 py-1.5 flex items-center gap-2`}>
        {isEntry && (
          <span className="text-[10px] font-bold bg-white/30 text-white rounded px-1">
            ENTRY
          </span>
        )}
        <span className="text-[10px] uppercase tracking-wide text-white/80 font-semibold">
          {nodeType}
        </span>
      </div>

      {/* Body */}
      <div className="px-3 py-2">
        <p className="text-sm font-medium text-slate-700 truncate">{label}</p>
        {children && <div className="mt-1">{children}</div>}
      </div>

      {/* Input handles */}
      {inputs.map((h, i) => (
        <Handle
          key={`in-${i}`}
          type="target"
          position={Position.Left}
          id={h.id}
          style={{ top: `${((i + 1) / (inputs.length + 1)) * 100}%` }}
          className="!w-3 !h-3 !bg-slate-400 !border-white !border-2"
        />
      ))}

      {/* Output handles */}
      {outputs.map((h, i) => (
        <div key={`out-${i}`}>
          {h.label && (
            <span
              className="absolute text-[9px] text-slate-400 font-medium"
              style={{
                right: 14,
                top: `calc(${((i + 1) / (outputs.length + 1)) * 100}% - 6px)`,
              }}
            >
              {h.label}
            </span>
          )}
          <Handle
            type="source"
            position={Position.Right}
            id={h.id}
            style={{ top: `${((i + 1) / (outputs.length + 1)) * 100}%` }}
            className="!w-3 !h-3 !bg-slate-500 !border-white !border-2"
          />
        </div>
      ))}
    </div>
  );
}
