import { WorkflowRunner } from './engine/WorkflowRunner';
import { NodeExecutorRegistry } from './engine/NodeExecutorRegistry';
import { HttpNode } from './nodes/HttpNode';
import { WorkflowDefinition } from './types/workflow.types';

// 1. Create the registry and register your nodes
const registry = new NodeExecutorRegistry();
registry.register('http', new HttpNode());

// 2. Create the runner
const runner = new WorkflowRunner(registry);

// 3. Define a sample workflow (this is your "workflow JSON")
const sampleWorkflow: WorkflowDefinition = {
  id: 'workflow-001',
  name: 'My First Workflow',
  version: 1,
  entryNodeId: 'node-1',
  nodes: [
    {
      id: 'node-1',
      type: 'http',
      name: 'Fetch a first fact',
      config: {
        url: 'https://uselessfacts.jsph.pl/api/v2/facts/random',
        method: 'GET',
      },
      next: ['node-2'],
    },
    {
      id: 'node-2',
      type: 'http',
      name: 'Fetch a second fact',
      config: {
        url: 'https://uselessfacts.jsph.pl/api/v2/facts/random',
        method: 'GET',
      },
      next: [],
    },
  ],
};

// 4. Run the workflow and print results
async function main() {
  console.log('🚀 Starting workflow:', sampleWorkflow.name);
  console.log('─'.repeat(40));

  try {
    const results = await runner.run(sampleWorkflow, { startedBy: 'manual' });

    for (const result of results) {
      console.log(`\n📦 Node: ${result.nodeId}`);
      console.log(`   Status  : ${result.status}`);
      console.log(`   Duration: ${result.durationMs}ms`);
      console.log(`   Output  :`, JSON.stringify(result.output, null, 2));
    }

    console.log('\n✅ Workflow completed successfully!');
  } catch (err) {
    console.error('❌ Workflow failed:', err);
  }
}

main();