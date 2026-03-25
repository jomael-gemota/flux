import type { ReactNode } from 'react';
import { Toolbar } from './Toolbar';
import { WorkflowSidebar } from './WorkflowSidebar';
import { useWorkflowStore } from '../store/workflowStore';

interface LayoutProps {
  canvas: ReactNode;
  configPanel: ReactNode;
  executionLog: ReactNode;
}

export function Layout({ canvas, configPanel, executionLog }: LayoutProps) {
  const { logOpen } = useWorkflowStore();

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-white overflow-hidden">
      <Toolbar />

      <div className="flex flex-1 min-h-0">
        <WorkflowSidebar />

        <div className="flex flex-1 min-w-0 flex-col">
          <div className="flex flex-1 min-h-0">
            {/* Canvas */}
            <div className="flex-1 min-w-0 relative">{canvas}</div>

            {/* Right config panel */}
            <div className="w-72 bg-slate-900 border-l border-slate-700 overflow-y-auto shrink-0">
              {configPanel}
            </div>
          </div>

          {/* Bottom execution log */}
          {logOpen && (
            <div className="h-64 border-t border-slate-700 shrink-0 overflow-hidden">
              {executionLog}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
