import { google } from 'googleapis';
import { NodeExecutor } from '../engine/NodeExecutor';
import { WorkflowNode, ExecutionContext } from '../types/workflow.types';
import { GoogleAuthService } from '../services/GoogleAuthService';
import { ExpressionResolver } from '../engine/ExpressionResolver';

type GDocsAction = 'create' | 'read' | 'append' | 'rename';

interface GDocsConfig {
    credentialId: string;
    action: GDocsAction;

    // ── create ────────────────────────────────────────────────────────────────
    title?: string;
    content?: string;
    folderId?: string;           // Drive folder to save the new document in

    // ── document identification (read / append / rename) ──────────────────────
    documentId?: string;         // direct Google Docs document ID (or expression)
    searchFolderId?: string;     // folder to search in when not using a direct ID
    documentName?: string;       // partial name to match
    owner?: string;              // filter by owner email

    // ── append ────────────────────────────────────────────────────────────────
    text?: string;
    // Link
    appendLink?: boolean;
    linkText?: string;
    linkUrl?: string;
    // Image
    appendImage?: boolean;
    imageUrl?: string;           // publicly-accessible URL (Docs API downloads it)
    imageWidth?: number;         // points (default 200)
    imageHeight?: number;        // points (default 200)

    // ── rename ────────────────────────────────────────────────────────────────
    newTitle?: string;
}

/** Escape single quotes for Drive query strings. */
const driveEscape = (s: string) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

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

        const auth  = await this.googleAuth.getAuthenticatedClient(credentialId);
        const docs  = google.docs({ version: 'v1', auth });
        const drive = google.drive({ version: 'v3', auth });

        // ── create ────────────────────────────────────────────────────────────

        if (action === 'create') {
            const title    = this.resolver.resolveTemplate(config.title ?? 'Untitled Document', context);
            const content  = this.resolver.resolveTemplate(config.content ?? '', context);
            const folderId = config.folderId
                ? this.resolver.resolveTemplate(config.folderId, context).trim()
                : undefined;

            // Use Drive API so we can place the document in a specific folder
            const requestBody: { name: string; mimeType: string; parents?: string[] } = {
                name:     title,
                mimeType: 'application/vnd.google-apps.document',
            };
            if (folderId) requestBody.parents = [folderId];

            const created = await drive.files.create({
                requestBody,
                fields: 'id,name,webViewLink',
            });
            const docId = created.data.id!;

            if (content) {
                await docs.documents.batchUpdate({
                    documentId: docId,
                    requestBody: {
                        requests: [{
                            insertText: {
                                location: { index: 1 },
                                text:     content,
                            },
                        }],
                    },
                });
            }

            return {
                documentId:  docId,
                title,
                url:         `https://docs.google.com/document/d/${docId}/edit`,
                webViewLink: created.data.webViewLink,
            };
        }

        // ── read ──────────────────────────────────────────────────────────────

        if (action === 'read') {
            const documentId = await this.resolveDocumentId(config, context, drive);

            const res = await docs.documents.get({ documentId });
            const doc = res.data;

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

        // ── append ────────────────────────────────────────────────────────────

        if (action === 'append') {
            const documentId = await this.resolveDocumentId(config, context, drive);
            const appended: string[] = [];

            // Append plain text
            const text = config.text
                ? this.resolver.resolveTemplate(config.text, context)
                : '';
            if (text) {
                const endIdx = await this.fetchEndIndex(docs, documentId);
                await docs.documents.batchUpdate({
                    documentId,
                    requestBody: {
                        requests: [{
                            insertText: {
                                location: { index: endIdx },
                                text:     '\n' + text,
                            },
                        }],
                    },
                });
                appended.push('text');
            }

            // Append hyperlink
            if (config.appendLink) {
                const linkText = this.resolver.resolveTemplate(config.linkText ?? '', context);
                const linkUrl  = this.resolver.resolveTemplate(config.linkUrl  ?? '', context);
                if (linkText && linkUrl) {
                    const endIdx = await this.fetchEndIndex(docs, documentId);
                    // Insert text, then apply link style in a single batch.
                    // Indices for updateTextStyle are relative to the state after insertText.
                    await docs.documents.batchUpdate({
                        documentId,
                        requestBody: {
                            requests: [
                                {
                                    insertText: {
                                        location: { index: endIdx },
                                        text:     '\n' + linkText,
                                    },
                                },
                                {
                                    updateTextStyle: {
                                        range: {
                                            startIndex: endIdx + 1,                          // after '\n'
                                            endIndex:   endIdx + 1 + linkText.length,
                                        },
                                        textStyle: { link: { url: linkUrl } },
                                        fields:    'link',
                                    },
                                },
                            ],
                        },
                    });
                    appended.push('link');
                }
            }

            // Append inline image
            if (config.appendImage) {
                const imageUrl = this.resolver.resolveTemplate(config.imageUrl ?? '', context);
                if (imageUrl) {
                    const endIdx = await this.fetchEndIndex(docs, documentId);
                    await docs.documents.batchUpdate({
                        documentId,
                        requestBody: {
                            requests: [{
                                insertInlineImage: {
                                    location:   { index: endIdx },
                                    uri:        imageUrl,
                                    objectSize: {
                                        height: { magnitude: config.imageHeight ?? 200, unit: 'PT' },
                                        width:  { magnitude: config.imageWidth  ?? 200, unit: 'PT' },
                                    },
                                },
                            }],
                        },
                    });
                    appended.push('image');
                }
            }

            return { documentId, appended };
        }

        // ── rename ────────────────────────────────────────────────────────────

        if (action === 'rename') {
            const documentId = await this.resolveDocumentId(config, context, drive);
            const newTitle   = this.resolver.resolveTemplate(config.newTitle ?? '', context);
            if (!newTitle) throw new Error('Google Docs rename: newTitle is required');

            const res = await drive.files.update({
                fileId:      documentId,
                requestBody: { name: newTitle },
                fields:      'id,name,webViewLink',
            });

            return {
                documentId,
                newTitle:    res.data.name,
                webViewLink: res.data.webViewLink,
            };
        }

        throw new Error(`Google Docs node: unknown action "${action}"`);
    }

    /**
     * Resolves a document ID either from a direct `documentId` field,
     * or by searching Drive by name / owner / folder.
     */
    private async resolveDocumentId(
        config: GDocsConfig,
        context: ExecutionContext,
        drive: ReturnType<typeof google.drive>,
    ): Promise<string> {
        const directId = config.documentId
            ? this.resolver.resolveTemplate(config.documentId, context).trim()
            : '';
        if (directId) return directId;

        // Build Drive query to find the document
        const queryParts = [
            `mimeType = 'application/vnd.google-apps.document'`,
            `trashed = false`,
        ];

        const searchFolderId = config.searchFolderId
            ? this.resolver.resolveTemplate(config.searchFolderId, context).trim()
            : '';
        if (searchFolderId) {
            queryParts.push(`'${driveEscape(searchFolderId)}' in parents`);
        }

        const documentName = config.documentName
            ? this.resolver.resolveTemplate(config.documentName, context).trim()
            : '';
        if (documentName) {
            queryParts.push(`name contains '${driveEscape(documentName)}'`);
        }

        const owner = config.owner
            ? this.resolver.resolveTemplate(config.owner, context).trim()
            : '';
        if (owner) {
            queryParts.push(`'${driveEscape(owner)}' in owners`);
        }

        const res = await drive.files.list({
            q:        queryParts.join(' and '),
            pageSize: 1,
            fields:   'files(id,name)',
            orderBy:  'modifiedTime desc',
        });

        const file = res.data.files?.[0];
        if (!file?.id) {
            throw new Error(
                'Google Docs: no document found matching the specified name / owner / folder. ' +
                'Provide a documentId, or set documentName / owner / searchFolderId.',
            );
        }
        return file.id;
    }

    /** Returns the insertion index just before the final paragraph break. */
    private async fetchEndIndex(
        docs: ReturnType<typeof google.docs>,
        documentId: string,
    ): Promise<number> {
        const res         = await docs.documents.get({ documentId });
        const bodyContent = res.data.body?.content ?? [];
        const last        = bodyContent[bodyContent.length - 1];
        return (last?.endIndex ?? 1) - 1;
    }
}
