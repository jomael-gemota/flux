import { NodeExecutor } from './NodeExecutor';
import { NodeType } from '../types/workflow.types';

export class NodeExecutorRegistry {
    private executors = new Map<NodeType, NodeExecutor>();

    register(type: NodeType, executor: NodeExecutor): void {
        this.executors.set(type, executor);
    }

    get(type: NodeType): NodeExecutor {
        const executor = this.executors.get(type);
        if (!executor) throw new Error(`No executor registered for node type: ${type}`);
        return executor;
    }
}