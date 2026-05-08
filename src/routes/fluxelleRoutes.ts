import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { apiKeyAuth } from '../middleware/auth';
import { toJsonSchema } from '../validation/toJsonSchema';
import { FluxelleService } from '../services/FluxelleService';
import type { FluxelleChatRequest } from '../services/FluxelleService';
import { SkillRegistry } from '../skills/SkillRegistry';
import { BadRequestError, NotFoundError } from '../errors/ApiError';

// ── Validation ────────────────────────────────────────────────────────────────

const ChatMessageSchema = z.object({
    role:    z.enum(['user', 'assistant']),
    content: z.string(),
});

const WorkflowSnapshotSchema = z.object({
    id:          z.string(),
    name:        z.string(),
    entryNodeId: z.string(),
    nodes: z.array(
        z.object({
            id:             z.string(),
            type:           z.string(),
            name:           z.string(),
            configPreview:  z.string(),
            next:           z.array(z.string()),
        }),
    ),
});

const ChatRequestSchema = z.object({
    messages: z.array(ChatMessageSchema).min(1),
    workflow: WorkflowSnapshotSchema.nullable().optional(),
});

// ── Routes ────────────────────────────────────────────────────────────────────

export async function fluxelleRoutes(
    fastify: FastifyInstance,
    options: {
        fluxelle: FluxelleService;
        skills:   SkillRegistry;
    },
): Promise<void> {
    const { fluxelle, skills } = options;

    /** Health / configuration probe — used by the UI to show a setup prompt. */
    fastify.get(
        '/fluxelle/status',
        { preHandler: apiKeyAuth },
        async () => ({
            configured: fluxelle.isConfigured(),
            model:      process.env.FLUXELLE_MODEL ?? 'gpt-4o-mini',
        }),
    );

    /** Main chat endpoint — JSON request/response (non-streaming v1). */
    fastify.post(
        '/fluxelle/chat',
        {
            preHandler: apiKeyAuth,
            schema:     { body: toJsonSchema(ChatRequestSchema) },
        },
        async (request, reply) => {
            const body = ChatRequestSchema.parse(request.body) as FluxelleChatRequest;

            if (!fluxelle.isConfigured()) {
                throw BadRequestError(
                    'Fluxelle is not configured on the server. Set OPENAI_API_KEY in your environment.',
                );
            }

            const response = await fluxelle.chat(body);
            return reply.code(200).send(response);
        },
    );

    /** Skills catalogue — summary list. */
    fastify.get(
        '/skills',
        { preHandler: apiKeyAuth },
        async () => ({ skills: skills.listSummaries() }),
    );

    /** Single skill — full markdown body. */
    fastify.get<{ Params: { name: string } }>(
        '/skills/:name',
        { preHandler: apiKeyAuth },
        async (request) => {
            const skill = skills.get(request.params.name);
            if (!skill) throw NotFoundError(`Skill ${request.params.name}`);
            return skill;
        },
    );
}
