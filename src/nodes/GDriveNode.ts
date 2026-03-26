import { google } from 'googleapis';
import { Readable } from 'stream';
import { NodeExecutor } from '../engine/NodeExecutor';
import { WorkflowNode, ExecutionContext } from '../types/workflow.types';
import { GoogleAuthService } from '../services/GoogleAuthService';
import { ExpressionResolver } from '../engine/ExpressionResolver';

type GDriveAction = 'list' | 'upload' | 'download';

interface GDriveConfig {
    credentialId: string;
    action: GDriveAction;
    // list
    query?: string;
    folderId?: string;
    maxResults?: number;
    // upload
    fileName?: string;
    mimeType?: string;
    content?: string;
    // download
    fileId?: string;
}

export class GDriveNode implements NodeExecutor {
    private googleAuth: GoogleAuthService;
    private resolver = new ExpressionResolver();

    constructor(googleAuth: GoogleAuthService) {
        this.googleAuth = googleAuth;
    }

    async execute(node: WorkflowNode, context: ExecutionContext): Promise<unknown> {
        const config = node.config as unknown as GDriveConfig;
        const { credentialId, action } = config;

        if (!credentialId) throw new Error('Google Drive node: credentialId is required');
        if (!action)       throw new Error('Google Drive node: action is required');

        const auth  = await this.googleAuth.getAuthenticatedClient(credentialId);
        const drive = google.drive({ version: 'v3', auth });

        if (action === 'list') {
            const query    = this.resolver.resolveTemplate(config.query ?? '', context);
            const folderId = config.folderId
                ? this.resolver.resolveTemplate(config.folderId, context)
                : undefined;
            const pageSize = config.maxResults ?? 20;

            let q = query || undefined;
            if (folderId) {
                q = `'${folderId}' in parents` + (q ? ` and ${q}` : '');
            }

            const res = await drive.files.list({
                q,
                pageSize,
                fields: 'files(id,name,mimeType,size,modifiedTime,webViewLink,parents)',
            });
            return { files: res.data.files ?? [] };
        }

        if (action === 'upload') {
            const fileName = this.resolver.resolveTemplate(config.fileName ?? 'untitled', context);
            const mimeType = config.mimeType ?? 'text/plain';
            const content  = this.resolver.resolveTemplate(config.content ?? '', context);
            const folderId = config.folderId
                ? this.resolver.resolveTemplate(config.folderId, context)
                : undefined;

            const media = {
                mimeType,
                body: Readable.from([content]),
            };

            const requestBody: { name: string; parents?: string[] } = { name: fileName };
            if (folderId) requestBody.parents = [folderId];

            const res = await drive.files.create({
                requestBody,
                media,
                fields: 'id,name,mimeType,size,webViewLink',
            });
            return res.data;
        }

        if (action === 'download') {
            const fileId = this.resolver.resolveTemplate(config.fileId ?? '', context);
            if (!fileId) throw new Error('Google Drive download: fileId is required');

            // Get file metadata first
            const meta = await drive.files.get({ fileId, fields: 'id,name,mimeType' });

            // Export Google-native files as text, otherwise download directly
            const googleMimeTypes: Record<string, string> = {
                'application/vnd.google-apps.document':     'text/plain',
                'application/vnd.google-apps.spreadsheet':  'text/csv',
                'application/vnd.google-apps.presentation': 'text/plain',
            };
            const exportMime = googleMimeTypes[meta.data.mimeType ?? ''];

            let content: string;
            if (exportMime) {
                const res = await drive.files.export({ fileId, mimeType: exportMime }, { responseType: 'text' });
                content = res.data as string;
            } else {
                const res = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'text' });
                content = res.data as string;
            }

            return { fileId, name: meta.data.name, mimeType: meta.data.mimeType, content };
        }

        throw new Error(`Google Drive node: unknown action "${action}"`);
    }
}
