import { FastifyInstance } from 'fastify';
import { apiKeyAuth } from '../middleware/auth';
import { ExecutionRepository } from '../repositories/ExecutionRepository';
import { WorkflowService } from '../services/WorkflowService';
import { ExecutionQuerySchema, DeleteExecutionsSchema } from '../validation/schemas';
import { toJsonSchema } from '../validation/toJsonSchema';
import { NotFoundError, BadRequestError } from '../errors/ApiError';
import { executionEventBus } from '../events/ExecutionEventBus';
import { ApiKeyModel } from '../db/models/ApiKeyModel';

export async function executionRoutes(
    fastify: FastifyInstance,
    options: {
        executionRepo: ExecutionRepository;
        workflowService: WorkflowService;
    }
): Promise<void> {
    const { executionRepo, workflowService } = options;

    fastify.get<{ Params: { id: string } }>(
        '/executions/:id',
        { preHandler: apiKeyAuth },
        async (request, reply) => {
            const execution = await executionRepo.findById(request.params.id);
            if (!execution) throw NotFoundError(`Execution ${request.params.id}`);
            return reply.code(200).send(execution);
        }
    );

    fastify.get<{ Querystring: { workflowId: string; limit?: number; cursor?: string } }>(
        '/executions',
        {
            preHandler: apiKeyAuth,
            schema: { querystring: toJsonSchema(ExecutionQuerySchema) },
        },
        async (request, reply) => {
            const { workflowId, limit = 20, cursor } = request.query;

            const result = await executionRepo.findByWorkflowIdPaginated(
                workflowId,
                limit,
                cursor
            );
            return reply.code(200).send(result);
        }
    );

    fastify.post<{ Params: { id: string } }>(
        '/executions/:id/replay',
        { preHandler: apiKeyAuth },
        async (request, reply) => {
            try {
                const summary = await workflowService.replay(request.params.id);
                return reply.code(200).send(summary);
            } catch {
                throw NotFoundError(`Execution ${request.params.id}`);
            }
        }
    );

    // ── Delete a single execution ──────────────────────────────────────────
    fastify.delete<{ Params: { id: string } }>(
        '/executions/:id',
        { preHandler: apiKeyAuth },
        async (request, reply) => {
            const deleted = await executionRepo.deleteById(request.params.id);
            if (!deleted) throw NotFoundError(`Execution ${request.params.id}`);
            return reply.code(200).send({ deleted: true, id: request.params.id });
        }
    );

    // ── Bulk delete: by IDs or all for a workflow ──────────────────────────
    fastify.delete<{ Body: { ids?: string[]; workflowId?: string; deleteAll?: boolean } }>(
        '/executions',
        {
            preHandler: apiKeyAuth,
            schema: { body: toJsonSchema(DeleteExecutionsSchema) },
        },
        async (request, reply) => {
            const { ids, workflowId, deleteAll } = request.body ?? {};

            if (ids && ids.length > 0) {
                const count = await executionRepo.deleteManyByIds(ids);
                return reply.code(200).send({ deleted: count });
            }

            if (workflowId && deleteAll === true) {
                const count = await executionRepo.deleteAllByWorkflowId(workflowId);
                return reply.code(200).send({ deleted: count });
            }

            throw BadRequestError('Provide either "ids" array or "workflowId" + "deleteAll": true');
        }
    );

    // ── SSE: stream live execution events to the browser ───────────────────
    // EventSource cannot send custom headers, so auth is passed via query params.
    fastify.get<{
        Params: { id: string };
        Querystring: { token?: string; apiKey?: string };
    }>(
        '/executions/:id/events',
        async (request, reply) => {
            const { token, apiKey } = request.query;

            if (token) {
                try {
                    const decoded = (fastify as any).jwt.verify(token) as { status?: string };
                    if (decoded.status && decoded.status !== 'approved') {
                        return reply.code(403).send({ message: 'Account pending approval' });
                    }
                } catch {
                    return reply.code(401).send({ message: 'Invalid or expired token' });
                }
            } else if (apiKey) {
                const doc = await ApiKeyModel.findOne({ key: apiKey });
                if (!doc) return reply.code(403).send({ message: 'Invalid API key' });
            } else {
                return reply.code(401).send({ message: 'Authentication required' });
            }

            const executionId = request.params.id;
            const execution = await executionRepo.findById(executionId);
            if (!execution) {
                return reply.code(404).send({ message: `Execution ${executionId} not found` });
            }

            // Hijack the raw response so Fastify doesn't auto-close it
            reply.hijack();
            const raw = reply.raw;

            raw.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'X-Accel-Buffering': 'no',
            });

            const send = (event: string, data: unknown) => {
                try {
                    raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
                } catch { /* client already disconnected */ }
            };

            // If already finished, replay results and close immediately
            if (execution.status !== 'pending' && execution.status !== 'running') {
                for (const result of execution.results) {
                    send('node_result', result);
                }
                send('complete', { executionId, status: execution.status });
                raw.end();
                return;
            }

            // Replay any partial results already persisted (incremental writes)
            for (const result of execution.results) {
                send('node_result', result);
            }

            let closed = false;

            const cleanup = () => {
                if (closed) return;
                closed = true;
                clearInterval(heartbeat);
                unsubNode();
                unsubComplete();
            };

            const unsubNode = executionEventBus.onNodeResult(executionId, (result) => {
                if (!closed) send('node_result', result);
            });

            const unsubComplete = executionEventBus.onComplete(executionId, (event) => {
                if (!closed) {
                    send('complete', { executionId, status: event.status });
                    cleanup();
                    raw.end();
                }
            });

            // Keep-alive heartbeat (prevents proxies/load-balancers from closing idle connections)
            const heartbeat = setInterval(() => {
                if (closed) return;
                try { raw.write(': heartbeat\n\n'); } catch { cleanup(); }
            }, 15_000);

            request.raw.on('close', cleanup);
            request.raw.on('error', cleanup);
        }
    );
}