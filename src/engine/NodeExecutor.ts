import { WorkflowNode, ExecutionContext } from '../types/workflow.types';

export interface NodeExecutor {
    execute(node: WorkflowNode, context: ExecutionContext): Promise<unknown>;
}