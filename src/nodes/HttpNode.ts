import { NodeExecutor } from '../engine/NodeExecutor';
import { WorkflowNode, ExecutionContext } from '../types/workflow.types';
import { ExpressionResolver } from '../engine/ExpressionResolver';

export class HttpNode implements NodeExecutor {
    private resolver = new ExpressionResolver();

    async execute(node: WorkflowNode, context: ExecutionContext): Promise<unknown> {
        const {
            url,
            method = 'GET',
            body,
            headers: customHeaders,
            bodyType,
            rawContentType,
            formData,
            authType,
            auth,
        } = node.config as {
            url: string;
            method?: string;
            body?: unknown;
            headers?: Record<string, string>;
            bodyType?: string;
            rawContentType?: string;
            formData?: Record<string, string>;
            authType?: string;
            auth?: Record<string, string>;
        };

        // Resolve expressions in the URL
        let resolvedUrl = this.resolver.resolveTemplate(url, context);

        // API Key in query param — append before the fetch
        if (authType === 'apikey-query' && auth?.key && auth?.value) {
            const resolvedKey = this.resolver.resolveTemplate(auth.key, context);
            const resolvedValue = this.resolver.resolveTemplate(auth.value, context);
            const separator = resolvedUrl.includes('?') ? '&' : '?';
            resolvedUrl = `${resolvedUrl}${separator}${encodeURIComponent(resolvedKey)}=${encodeURIComponent(resolvedValue)}`;
        }

        // Resolve expressions in each custom header value
        const resolvedCustomHeaders: Record<string, string> = {};
        if (customHeaders) {
            for (const [key, value] of Object.entries(customHeaders)) {
                resolvedCustomHeaders[key] = this.resolver.resolveTemplate(String(value), context);
            }
        }

        // Build Authorization header
        const authHeaders: Record<string, string> = {};
        if (authType === 'bearer' && auth?.token) {
            const resolvedToken = this.resolver.resolveTemplate(auth.token, context);
            authHeaders['Authorization'] = `Bearer ${resolvedToken}`;
        } else if (authType === 'basic' && (auth?.username || auth?.password)) {
            const resolvedUsername = this.resolver.resolveTemplate(auth?.username ?? '', context);
            const resolvedPassword = this.resolver.resolveTemplate(auth?.password ?? '', context);
            const encoded = Buffer.from(`${resolvedUsername}:${resolvedPassword}`).toString('base64');
            authHeaders['Authorization'] = `Basic ${encoded}`;
        } else if (authType === 'apikey-header' && auth?.key && auth?.value) {
            const resolvedKey = this.resolver.resolveTemplate(auth.key, context);
            const resolvedValue = this.resolver.resolveTemplate(auth.value, context);
            authHeaders[resolvedKey] = resolvedValue;
        }

        // Determine effective body type (backward-compat: nodes without bodyType that have body → treat as raw)
        const effectiveBodyType = bodyType ?? (body != null ? 'raw' : 'none');
        const hasBody = effectiveBodyType !== 'none' && method !== 'GET' && method !== 'HEAD';

        let fetchBody: BodyInit | undefined;
        const contentTypeHeaders: Record<string, string> = {};

        if (hasBody) {
            if (effectiveBodyType === 'raw') {
                const resolvedBody = body != null ? this.resolveBody(body, context) : undefined;
                if (resolvedBody !== undefined) {
                    contentTypeHeaders['Content-Type'] = this.rawContentTypeHeader(rawContentType);
            if (rawContentType === 'text' || rawContentType === 'html' || rawContentType === 'xml') {
                    fetchBody = typeof resolvedBody === 'string' ? resolvedBody : JSON.stringify(resolvedBody);
                } else {
                    // JSON mode: body may be stored as a raw string — parse it first so we
                    // don't double-encode (JSON.stringify of a string wraps it in extra quotes)
                    if (typeof resolvedBody === 'string') {
                        try {
                            fetchBody = JSON.stringify(JSON.parse(resolvedBody));
                        } catch {
                            fetchBody = resolvedBody; // invalid JSON — send as-is
                        }
                    } else {
                        fetchBody = JSON.stringify(resolvedBody);
                    }
                }
                }
            } else if (effectiveBodyType === 'form-data') {
                const fd = new FormData();
                if (formData) {
                    for (const [key, value] of Object.entries(formData)) {
                        fd.append(key, this.resolver.resolveTemplate(String(value), context));
                    }
                }
                fetchBody = fd;
                // Let fetch set Content-Type with boundary for multipart/form-data automatically
            } else if (effectiveBodyType === 'urlencoded') {
                const params = new URLSearchParams();
                if (formData) {
                    for (const [key, value] of Object.entries(formData)) {
                        params.append(key, this.resolver.resolveTemplate(String(value), context));
                    }
                }
                fetchBody = params;
                contentTypeHeaders['Content-Type'] = 'application/x-www-form-urlencoded';
            }
        }

        // Merge headers: content-type → auth → custom (custom always wins)
        const headers: Record<string, string> = {
            ...contentTypeHeaders,
            ...authHeaders,
            ...resolvedCustomHeaders,
        };

        const response = await fetch(resolvedUrl, {
            method,
            headers,
            body: fetchBody,
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

        const responseContentType = response.headers.get('content-type') ?? '';
        if (responseContentType.includes('application/json')) {
            return { status: response.status, body: await response.json(), headers: Object.fromEntries(response.headers) };
        }
        return { status: response.status, body: await response.text(), headers: Object.fromEntries(response.headers) };
    }

    private rawContentTypeHeader(rawContentType?: string): string {
        switch (rawContentType) {
            case 'text': return 'text/plain';
            case 'html': return 'text/html';
            case 'xml': return 'application/xml';
            default: return 'application/json';
        }
    }

    private resolveBody(body: unknown, context: ExecutionContext): unknown {
        if (typeof body === 'string') {
            return this.resolver.resolve(body, context);
        }
        if (Array.isArray(body)) {
            return body.map(item => this.resolveBody(item, context));
        }
        if (body !== null && typeof body === 'object') {
            const result: Record<string, unknown> = {};
            for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
                result[k] = this.resolveBody(v, context);
            }
            return result;
        }
        return body;
    }
}
