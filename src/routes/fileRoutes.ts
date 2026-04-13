import { FastifyInstance } from 'fastify';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import crypto from 'crypto';

// ── Staging directory ─────────────────────────────────────────────────────────
const STAGING_DIR = join(tmpdir(), 'wap-staged-files');
const FILE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

async function ensureStagingDir() {
    await fs.mkdir(STAGING_DIR, { recursive: true });
}

// ── Public helpers (used by SlackNode) ────────────────────────────────────────

export interface StagedFileMeta {
    filename:  string;
    mimeType:  string;
    size:      number;
    createdAt: number;
    expiresAt: number;
}

export async function readStagedFile(stagedFileId: string): Promise<{
    buffer:   Buffer;
    filename: string;
    mimeType: string;
} | null> {
    const dir = join(STAGING_DIR, stagedFileId);
    try {
        const meta: StagedFileMeta = JSON.parse(
            await fs.readFile(join(dir, 'meta.json'), 'utf-8')
        );
        if (Date.now() > meta.expiresAt) {
            await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
            return null;
        }
        const buffer = await fs.readFile(join(dir, 'data'));
        return { buffer, filename: meta.filename, mimeType: meta.mimeType };
    } catch {
        return null;
    }
}

export async function deleteStagedFile(stagedFileId: string): Promise<void> {
    const dir = join(STAGING_DIR, stagedFileId);
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
}

// ── Route registration ────────────────────────────────────────────────────────

export async function fileRoutes(fastify: FastifyInstance): Promise<void> {
    await ensureStagingDir();

    /**
     * POST /files/stage
     *
     * Pre-upload a file before workflow execution. The file is stored on disk
     * and a lightweight reference ID is returned. Store the ID in the node
     * config instead of the raw base64 so large files never bloat workflow saves.
     *
     * Body: { filename: string; mimeType: string; data: string }
     *       data = base64 string (with or without data-URL prefix)
     *
     * Per-route bodyLimit of 300 MB overrides the global 50 MB limit so large
     * files (e.g. 60+ MB Excel spreadsheets) can be staged without hitting the
     * connection-reset caused by the global body cap.
     */
    fastify.post<{
        Body: { filename: string; mimeType?: string; data: string };
    }>(
        '/files/stage',
        {
            // Override the global 50 MB body limit for this route only
            bodyLimit: 300 * 1024 * 1024,
        },
        async (request, reply) => {
            const { filename, mimeType, data } = request.body;

            if (!filename?.trim()) return reply.badRequest('filename is required');
            if (!data?.trim())     return reply.badRequest('data (base64) is required');

            // Decode: strip data-URL prefix if present, then base64-decode
            const b64    = data.includes(',') ? data.split(',')[1] : data;
            const buffer = Buffer.from(b64, 'base64');

            // Sniff MIME from data-URL prefix when the caller didn't supply one
            const resolvedMime =
                mimeType ||
                data.match(/^data:([^;]+);/)?.[1] ||
                'application/octet-stream';

            const stagedFileId = crypto.randomUUID();
            const dir          = join(STAGING_DIR, stagedFileId);
            await fs.mkdir(dir, { recursive: true });
            await fs.writeFile(join(dir, 'data'), buffer);
            await fs.writeFile(join(dir, 'meta.json'), JSON.stringify({
                filename,
                mimeType:  resolvedMime,
                size:      buffer.length,
                createdAt: Date.now(),
                expiresAt: Date.now() + FILE_TTL_MS,
            } satisfies StagedFileMeta));

            // Best-effort cleanup of expired staging files on each new upload
            cleanupExpired().catch(() => {});

            return reply.code(201).send({
                stagedFileId,
                filename,
                mimeType:  resolvedMime,
                size:      buffer.length,
                expiresAt: new Date(Date.now() + FILE_TTL_MS).toISOString(),
            });
        }
    );
}

// ── Internal helpers ──────────────────────────────────────────────────────────

async function cleanupExpired(): Promise<void> {
    const entries = await fs.readdir(STAGING_DIR).catch(() => [] as string[]);
    const now     = Date.now();
    for (const entry of entries) {
        try {
            const meta: StagedFileMeta = JSON.parse(
                await fs.readFile(join(STAGING_DIR, entry, 'meta.json'), 'utf-8')
            );
            if (now > meta.expiresAt) {
                await fs.rm(join(STAGING_DIR, entry), { recursive: true, force: true });
            }
        } catch { /* ignore malformed entries */ }
    }
}
