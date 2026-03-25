import { Layout } from './components/Layout';
import { WorkflowCanvas } from './components/canvas/WorkflowCanvas';
import { NodeConfigPanel } from './components/panels/NodeConfigPanel';
import { ExecutionLogPanel } from './components/panels/ExecutionLogPanel';

export default function App() {
  return (
    <Layout
      canvas={<WorkflowCanvas />}
      configPanel={<NodeConfigPanel />}
      executionLog={<ExecutionLogPanel />}
    />
  );
}
