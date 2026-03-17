import { NodeExecutor } from '../engine/NodeExecutor';
import { WorkflowNode, ExecutionContext } from '../types/workflow.types';

export class HttpNode implements NodeExecutor {
    async execute(node: WorkflowNode, context: ExecutionContext): Promise<unknown> {
        const { url, method = 'GET', body } = node.config as {
            url: string;
            method?: string;
            body?: unknown;
        };

        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: body ? JSON.stringify(body) : undefined,
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        return response.json();
    }
}