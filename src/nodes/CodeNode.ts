import { NodeExecutor } from '../engine/NodeExecutor';
import { WorkflowNode, ExecutionContext } from '../types/workflow.types';

interface CodeNodeConfig {
    /** User-supplied JavaScript. Last expression / explicit `return` becomes the node output. */
    code: string;
}

interface CapturedLog {
    level: 'log' | 'info' | 'warn' | 'error';
    message: string;
    timestamp: string;
}

/**
 * Executes arbitrary JavaScript supplied by the workflow author.
 *
 * Globals exposed to user code:
 *   • `nodes`       — every prior node's output, keyed by node id
 *   • `input`       — workflow-level input payload
 *   • `console`     — captured into the node output's `logs` array
 *   • `workflow`    — { id }
 *   • `execution`   — { id, startedAt }
 *   • `require`     — full Node.js `require` (this is a privileged execution mode)
 *   • `process`, `Buffer`, `fetch`, etc. — inherited from the host
 *
 * The user code is wrapped in an `async` IIFE so `await` is always available.
 * The value returned from the user code becomes `output.result`.
 */
export class CodeNode implements NodeExecutor {
    async execute(node: WorkflowNode, context: ExecutionContext): Promise<unknown> {
        const config = node.config as unknown as CodeNodeConfig;
        const userCode = (config.code ?? '').trim();
        if (!userCode) throw new Error('Code node: code is required');

        const logs: CapturedLog[] = [];
        const capture = (level: CapturedLog['level']) =>
            (...args: unknown[]) => {
                logs.push({
                    level,
                    message: args.map(safeStringify).join(' '),
                    timestamp: new Date().toISOString(),
                });
            };
        const sandboxConsole = {
            log:   capture('log'),
            info:  capture('info'),
            warn:  capture('warn'),
            error: capture('error'),
            debug: capture('log'),
        };

        // Wrap user code in an async IIFE so `await` works seamlessly and
        // `return` from the user's code produces our value.
        const wrapped = `return (async () => {\n${userCode}\n})();`;

        // eslint-disable-next-line @typescript-eslint/ban-types
        let asyncFn: Function;
        try {
            asyncFn = new Function(
                'nodes', 'input', 'console', 'workflow', 'execution',
                wrapped,
            );
        } catch (err) {
            throw new Error(`Code node: syntax error — ${(err as Error).message}`);
        }

        let result: unknown;
        try {
            result = await asyncFn(
                context.variables,
                context.variables.input,
                sandboxConsole,
                { id: context.workflowId },
                { id: context.executionId, startedAt: context.startedAt.toISOString() },
            );
        } catch (err) {
            const detail = err instanceof Error ? err.message : String(err);
            throw new Error(`Code node: runtime error — ${detail}`);
        }

        return { result, logs };
    }
}

function safeStringify(value: unknown): string {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'string') return value;
    if (typeof value === 'object') {
        try { return JSON.stringify(value); } catch { return '[Circular]'; }
    }
    return String(value);
}
