import { google } from 'googleapis';
import { NodeExecutor } from '../engine/NodeExecutor';
import { WorkflowNode, ExecutionContext } from '../types/workflow.types';
import { GoogleAuthService } from '../services/GoogleAuthService';
import { ExpressionResolver } from '../engine/ExpressionResolver';

type GDocsAction = 'create' | 'read' | 'append';

interface GDocsConfig {
    credentialId: string;
    action: GDocsAction;
    // create
    title?: string;
    content?: string;
    // read / append
    documentId?: string;
    // append
    text?: string;
}

export class GDocsNode implements NodeExecutor {
    private googleAuth: GoogleAuthService;
    private resolver = new ExpressionResolver();

    constructor(googleAuth: GoogleAuthService) {
        this.googleAuth = googleAuth;
    }

    async execute(node: WorkflowNode, context: ExecutionContext): Promise<unknown> {
        const config = node.config as unknown as GDocsConfig;
        const { credentialId, action } = config;

        if (!credentialId) throw new Error('Google Docs node: credentialId is required');
        if (!action)       throw new Error('Google Docs node: action is required');

        const auth = await this.googleAuth.getAuthenticatedClient(credentialId);
        const docs = google.docs({ version: 'v1', auth });

        if (action === 'create') {
            const title   = this.resolver.resolveTemplate(config.title ?? 'Untitled Document', context);
            const content = this.resolver.resolveTemplate(config.content ?? '', context);

            const created = await docs.documents.create({ requestBody: { title } });
            const docId   = created.data.documentId!;

            if (content) {
                await docs.documents.batchUpdate({
                    documentId: docId,
                    requestBody: {
                        requests: [
                            {
                                insertText: {
                                    location: { index: 1 },
                                    text: content,
                                },
                            },
                        ],
                    },
                });
            }

            return {
                documentId: docId,
                title,
                url: `https://docs.google.com/document/d/${docId}/edit`,
            };
        }

        if (action === 'read') {
            const documentId = this.resolver.resolveTemplate(config.documentId ?? '', context);
            if (!documentId) throw new Error('Google Docs read: documentId is required');

            const res = await docs.documents.get({ documentId });
            const doc = res.data;

            // Extract plain text from the document body
            let text = '';
            for (const element of doc.body?.content ?? []) {
                for (const pe of element.paragraph?.elements ?? []) {
                    text += pe.textRun?.content ?? '';
                }
            }

            return {
                documentId: doc.documentId,
                title:      doc.title,
                text:       text.trim(),
                revisionId: doc.revisionId,
            };
        }

        if (action === 'append') {
            const documentId = this.resolver.resolveTemplate(config.documentId ?? '', context);
            const text       = this.resolver.resolveTemplate(config.text ?? '', context);
            if (!documentId) throw new Error('Google Docs append: documentId is required');
            if (!text)       throw new Error('Google Docs append: text is required');

            // Get current end-of-document index
            const current   = await docs.documents.get({ documentId });
            const bodyContent = current.data.body?.content ?? [];
            const lastElement = bodyContent[bodyContent.length - 1];
            const endIndex   = lastElement?.endIndex ?? 1;

            await docs.documents.batchUpdate({
                documentId,
                requestBody: {
                    requests: [
                        {
                            insertText: {
                                location: { index: endIndex - 1 },
                                text: '\n' + text,
                            },
                        },
                    ],
                },
            });

            return { documentId, appended: text, endIndex };
        }

        throw new Error(`Google Docs node: unknown action "${action}"`);
    }
}
