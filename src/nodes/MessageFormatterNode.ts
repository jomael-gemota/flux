import { NodeExecutor } from '../engine/NodeExecutor';
import { WorkflowNode, ExecutionContext } from '../types/workflow.types';
import { ExpressionResolver } from '../engine/ExpressionResolver';

export type FormatterMedium = 'slack' | 'teams' | 'gmail' | 'gdocs';
export type TeamsLayout    = 'table' | 'text';
export type GmailLayout    = 'table' | 'text';

interface MessageFormatterConfig {
    medium:       FormatterMedium;
    template:     string;
    teamsLayout?: TeamsLayout;
    gmailLayout?: GmailLayout;
}

function isMessageFormatterConfig(config: unknown): config is MessageFormatterConfig {
    if (typeof config !== 'object' || config === null) return false;
    const c = config as Record<string, unknown>;
    return (
        typeof c.template === 'string' &&
        (c.medium === 'slack' || c.medium === 'teams' || c.medium === 'gmail' || c.medium === 'gdocs')
    );
}

// ── Shared utilities ──────────────────────────────────────────────────────────

const PH_PREFIX      = '\x02FMTPH_';
const PH_SUFFIX      = '_\x03';
const PH_RE          = /\x02FMTPH_\d+_\x03/g;
const SINGLE_PH_RE   = /^\x02FMTPH_\d+_\x03$/;

function humanizeKey(key: string): string {
    return key
        .replace(/([A-Z])/g, ' $1')
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/^\w/, c => c.toUpperCase());
}

function truncate(s: string): string {
    return String(s).replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
}

// ── Slack (mrkdwn) value formatter ────────────────────────────────────────────

function slackValue(value: unknown, depth = 0): string {
    if (value === null || value === undefined || value === '') return '_none_';
    if (typeof value !== 'object') return truncate(String(value));

    const pad = '  '.repeat(depth);

    if (Array.isArray(value)) {
        if (value.length === 0) return '_empty list_';
        return value
            .map((item, i) => {
                if (typeof item !== 'object' || item === null) {
                    return `${pad}• ${truncate(String(item))}`;
                }
                const fields = slackObject(item as Record<string, unknown>, depth + 1);
                return `${pad}*${i + 1}.*\n${fields}`;
            })
            .join('\n\n');
    }

    return slackObject(value as Record<string, unknown>, depth);
}

function slackObject(obj: Record<string, unknown>, depth = 0): string {
    const pad = '  '.repeat(depth);
    const lines: string[] = [];

    for (const [k, v] of Object.entries(obj)) {
        if (v === null || v === undefined || v === '') continue;
        const label = humanizeKey(k);
        if (typeof v === 'object') {
            lines.push(`${pad}• *${label}:*`);
            lines.push(slackValue(v, depth + 1));
        } else {
            lines.push(`${pad}• *${label}:* ${truncate(String(v))}`);
        }
    }

    return lines.join('\n');
}

// ── MS Teams shared string renderer ──────────────────────────────────────────
// Converts any primitive string (including multi-line email bodies) into HTML.
// Each line is HTML-escaped first, then inline markdown (**, *, _, `, ---) is
// converted to the corresponding HTML tags so formatting embedded anywhere in
// the data — even deep inside an email body — renders correctly in Teams.

function teamsFormatString(raw: unknown): string {
    const text = truncate(String(raw ?? ''));
    if (!text) return '<em>none</em>';

    const lines = text.split('\n');
    const out: string[] = [];

    for (const line of lines) {
        if (/^---+$/.test(line.trim())) {
            out.push('<hr/>');
        } else if (line.trim() === '') {
            // Preserve intentional blank lines between paragraphs
            out.push('');
        } else {
            // escapeHtml first so we don't double-escape, then apply inline markdown
            out.push(teamsInlineHtml(escapeHtml(line)));
        }
    }

    // Join with <br/> but skip consecutive empty markers to avoid piling up whitespace
    return out
        .reduce<string[]>((acc, l) => {
            if (l === '' && acc[acc.length - 1] === '') return acc;
            acc.push(l);
            return acc;
        }, [])
        .join('<br/>');
}

// ── MS Teams tabular value formatter ─────────────────────────────────────────

function teamsValue(value: unknown, depth = 0): string {
    if (value === null || value === undefined || value === '') {
        return '<em>none</em>';
    }
    if (typeof value !== 'object') return teamsFormatString(value);

    if (Array.isArray(value)) {
        if (value.length === 0) return '<em>empty list</em>';
        const items = value
            .map((item) => {
                if (typeof item !== 'object' || item === null) {
                    return `<li>${teamsFormatString(item)}</li>`;
                }
                return `<li>${teamsObject(item as Record<string, unknown>, depth + 1)}</li>`;
            })
            .join('');
        return `<ol>${items}</ol>`;
    }

    return teamsObject(value as Record<string, unknown>, depth);
}

function teamsObject(obj: Record<string, unknown>, depth = 0): string {
    const rows = Object.entries(obj)
        .filter(([, v]) => v !== null && v !== undefined && v !== '')
        .map(([k, v]) => {
            const label = humanizeKey(k);
            const cell = typeof v === 'object'
                ? teamsValue(v, depth + 1)
                : teamsFormatString(v);
            return `<tr><td style="padding:1px 10px 1px 0;vertical-align:top;white-space:nowrap"><strong>${escapeHtml(label)}:</strong></td><td style="padding:1px 0;vertical-align:top">${cell}</td></tr>`;
        })
        .join('');
    return `<table>${rows}</table>`;
}

// ── MS Teams text-style (bullet/indent) value formatter ───────────────────────

function teamsValueText(value: unknown, depth = 0): string {
    if (value === null || value === undefined || value === '') {
        return '<em>none</em>';
    }
    if (typeof value !== 'object') return teamsFormatString(value);

    if (Array.isArray(value)) {
        if (value.length === 0) return '<em>empty list</em>';
        const items = value
            .map((item, i) => {
                if (typeof item !== 'object' || item === null) {
                    return `<li>${teamsFormatString(item)}</li>`;
                }
                return `<li><strong>${i + 1}.</strong>${teamsObjectText(item as Record<string, unknown>, depth + 1)}</li>`;
            })
            .join('');
        return `<ul>${items}</ul>`;
    }

    return teamsObjectText(value as Record<string, unknown>, depth);
}

function teamsObjectText(obj: Record<string, unknown>, depth = 0): string {
    const items = Object.entries(obj)
        .filter(([, v]) => v !== null && v !== undefined && v !== '')
        .map(([k, v]) => {
            const label = humanizeKey(k);
            if (typeof v === 'object') {
                return `<li><strong>${escapeHtml(label)}:</strong>${teamsValueText(v, depth + 1)}</li>`;
            }
            return `<li><strong>${escapeHtml(label)}:</strong> ${teamsFormatString(v)}</li>`;
        })
        .join('');
    return `<ul>${items}</ul>`;
}

// ── Gmail shared string renderer ──────────────────────────────────────────────
// Applies inline-markdown → HTML conversion to every primitive string value
// anywhere in the data tree (email body, subject, snippets, etc.).

function gmailFormatString(raw: unknown): string {
    const text = truncate(String(raw ?? ''));
    if (!text) return '<em style="color:#94a3b8">none</em>';

    const lines = text.split('\n');
    const out: string[] = [];

    for (const line of lines) {
        if (/^---+$/.test(line.trim())) {
            out.push('<hr style="border:none;border-top:1px solid #e2e8f0;margin:6px 0"/>');
        } else if (line.trim() === '') {
            out.push('');
        } else {
            out.push(inlineHtml(escapeHtml(line)));
        }
    }

    return out
        .reduce<string[]>((acc, l) => {
            if (l === '' && acc[acc.length - 1] === '') return acc;
            acc.push(l);
            return acc;
        }, [])
        .join('<br/>');
}

// ── Gmail tabular value formatter ─────────────────────────────────────────────

function gmailValue(value: unknown, depth = 0): string {
    if (value === null || value === undefined || value === '') {
        return '<em style="color:#94a3b8">none</em>';
    }
    if (typeof value !== 'object') return gmailFormatString(value);

    if (Array.isArray(value)) {
        if (value.length === 0) return '<em style="color:#94a3b8">empty list</em>';
        const items = value
            .map((item) => {
                if (typeof item !== 'object' || item === null) {
                    return `<li style="font-size:13px;color:#1e293b;margin-bottom:2px">${gmailFormatString(item)}</li>`;
                }
                return `<li style="margin-bottom:4px">${gmailObject(item as Record<string, unknown>, depth + 1)}</li>`;
            })
            .join('');
        return `<ol style="margin:6px 0;padding-left:20px">${items}</ol>`;
    }

    return gmailObject(value as Record<string, unknown>, depth);
}

function gmailObject(obj: Record<string, unknown>, depth = 0): string {
    const rows = Object.entries(obj)
        .filter(([, v]) => v !== null && v !== undefined && v !== '')
        .map(([k, v]) => {
            const label = humanizeKey(k);
            const cell = typeof v === 'object'
                ? gmailValue(v, depth + 1)
                : gmailFormatString(v);
            return `<tr>
  <td style="padding:5px 10px 5px 8px;vertical-align:top;white-space:nowrap;width:1%;color:#475569;font-weight:600;font-size:12px;border:1px solid #cbd5e1;background-color:#f8fafc">${escapeHtml(label)}</td>
  <td style="padding:5px 8px;vertical-align:top;font-size:13px;color:#1e293b;border:1px solid #cbd5e1;word-break:break-word">${cell}</td>
</tr>`;
        })
        .join('');

    return `<table style="border-collapse:collapse;margin:6px 0;width:100%">${rows}</table>`;
}

// ── Gmail text-style (bullet/indent) value formatter ─────────────────────────

function gmailValueText(value: unknown, depth = 0): string {
    if (value === null || value === undefined || value === '') {
        return '<em style="color:#94a3b8">none</em>';
    }
    if (typeof value !== 'object') return gmailFormatString(value);

    if (Array.isArray(value)) {
        if (value.length === 0) return '<em style="color:#94a3b8">empty list</em>';
        const items = value
            .map((item, i) => {
                if (typeof item !== 'object' || item === null) {
                    return `<li style="font-size:13px;color:#1e293b;margin-bottom:2px">${gmailFormatString(item)}</li>`;
                }
                return `<li style="margin-bottom:6px"><strong style="color:#1e293b">${i + 1}.</strong>${gmailObjectText(item as Record<string, unknown>, depth + 1)}</li>`;
            })
            .join('');
        return `<ul style="margin:4px 0;padding-left:20px">${items}</ul>`;
    }

    return gmailObjectText(value as Record<string, unknown>, depth);
}

function gmailObjectText(obj: Record<string, unknown>, depth = 0): string {
    const items = Object.entries(obj)
        .filter(([, v]) => v !== null && v !== undefined && v !== '')
        .map(([k, v]) => {
            const label = humanizeKey(k);
            if (typeof v === 'object') {
                return `<li style="margin-bottom:4px"><span style="color:#64748b;font-weight:600;font-size:12px">${escapeHtml(label)}:</span>${gmailValueText(v, depth + 1)}</li>`;
            }
            return `<li style="font-size:13px;color:#1e293b;margin-bottom:2px"><span style="color:#64748b;font-weight:600;font-size:12px">${escapeHtml(label)}:</span> ${gmailFormatString(v)}</li>`;
        })
        .join('');
    return `<ul style="margin:4px 0;padding-left:${16 + depth * 12}px">${items}</ul>`;
}

// ── Google Docs shared string renderer ────────────────────────────────────────
// Strips markdown syntax from raw string values so **bold** → bold, etc.

function gdocsFormatString(raw: unknown): string {
    const text = truncate(String(raw ?? ''));
    if (!text) return '(none)';
    return text
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/\*(.+?)\*/g,     '$1')
        .replace(/_(.+?)_/g,       '$1')
        .replace(/`(.+?)`/g,       '$1')
        .replace(/^---+$/gm,       '─'.repeat(40));
}

// ── Google Docs bullet value formatter ───────────────────────────────────────

function gdocsValueText(value: unknown, depth = 0): string {
    if (value === null || value === undefined || value === '') return '(none)';
    if (typeof value !== 'object') return gdocsFormatString(value);

    const pad = '  '.repeat(depth);

    if (Array.isArray(value)) {
        if (value.length === 0) return '(empty list)';
        return value
            .map((item, i) => {
                if (typeof item !== 'object' || item === null) {
                    return `${pad}  ${i + 1}. ${gdocsFormatString(item)}`;
                }
                return `${pad}  ${i + 1}.\n${gdocsObjectText(item as Record<string, unknown>, depth + 1)}`;
            })
            .join('\n\n');
    }

    return gdocsObjectText(value as Record<string, unknown>, depth);
}

function gdocsObjectText(obj: Record<string, unknown>, depth = 0): string {
    const pad = '  '.repeat(depth);
    const lines: string[] = [];

    for (const [k, v] of Object.entries(obj)) {
        if (v === null || v === undefined || v === '') continue;
        const label = humanizeKey(k);
        if (typeof v === 'object') {
            lines.push(`${pad}  • ${label}:`);
            lines.push(gdocsValueText(v, depth + 1));
        } else {
            lines.push(`${pad}  • ${label}: ${gdocsFormatString(v)}`);
        }
    }

    return lines.join('\n');
}

// ── HTML helpers ──────────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function inlineHtml(line: string): string {
    line = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    line = line.replace(/\*(.+?)\*/g, '<em>$1</em>');
    line = line.replace(/_(.+?)_/g, '<em>$1</em>');
    line = line.replace(/`(.+?)`/g, '<code>$1</code>');
    return line;
}

// ── Markdown → Slack mrkdwn converter ────────────────────────────────────────

function toSlackMrkdwn(text: string): string {
    const lines = text.split('\n');
    const out: string[] = [];

    for (const raw of lines) {
        let l = raw;
        if (SINGLE_PH_RE.test(l.trim())) { out.push(l); continue; }

        l = l.replace(/^---+$/, '────────────────────────');
        l = l.replace(/^#{1,6}\s+(.+)$/, '*$1*');
        l = l.replace(/^[-*]\s+(.+)$/, '• $1');

        const BOLD_PH = '\x00B\x00';
        l = l.replace(/\*\*(.+?)\*\*/g, `${BOLD_PH}$1${BOLD_PH}`);
        l = l.replace(/(?<!\x00)\*(?!\*)(.+?)(?<!\*)\*(?!\x00)/g, '_$1_');
        l = l.replace(new RegExp(`${BOLD_PH.replace(/\x00/g, '\\x00')}(.+?)${BOLD_PH.replace(/\x00/g, '\\x00')}`, 'g'), '*$1*');
        l = l.replace(/^>\s?(.+)$/, '>$1');

        out.push(l);
    }

    return out.join('\n');
}

// ── Inline HTML helper for Teams ─────────────────────────────────────────────

function teamsInlineHtml(line: string): string {
    line = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    line = line.replace(/\*(.+?)\*/g,     '<em>$1</em>');
    line = line.replace(/_(.+?)_/g,       '<em>$1</em>');
    line = line.replace(/`(.+?)`/g,       '<code>$1</code>');
    return line;
}

// ── Markdown → MS Teams HTML converter ───────────────────────────────────────
// Teams renders HTML properly when sent with contentType: 'html' via the
// Graph API. This is far more reliable than Teams' inconsistent markdown support.

function toTeamsHtml(text: string): string {
    const lines = text.split('\n');
    const out: string[] = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];

        if (SINGLE_PH_RE.test(line.trim())) { out.push(line.trim()); i++; continue; }

        if (/^---+$/.test(line)) {
            out.push('<hr/>'); i++; continue;
        }

        const hMatch = line.match(/^(#{1,6})\s+(.+)$/);
        if (hMatch) {
            const level = hMatch[1].length;
            out.push(`<h${level}>${teamsInlineHtml(escapeHtml(hMatch[2]))}</h${level}>`);
            i++; continue;
        }

        if (/^>\s?/.test(line)) {
            const items: string[] = [];
            while (i < lines.length && /^>\s?/.test(lines[i])) {
                items.push(teamsInlineHtml(escapeHtml(lines[i].replace(/^>\s?/, ''))));
                i++;
            }
            out.push(`<blockquote>${items.join('<br/>')}</blockquote>`);
            continue;
        }

        if (/^[-*]\s+/.test(line)) {
            const items: string[] = [];
            while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
                items.push(`<li>${teamsInlineHtml(escapeHtml(lines[i].replace(/^[-*]\s+/, '')))}</li>`);
                i++;
            }
            out.push(`<ul>${items.join('')}</ul>`);
            continue;
        }

        if (/^\d+\.\s+/.test(line)) {
            const items: string[] = [];
            while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
                items.push(`<li>${teamsInlineHtml(escapeHtml(lines[i].replace(/^\d+\.\s+/, '')))}</li>`);
                i++;
            }
            out.push(`<ol>${items.join('')}</ol>`);
            continue;
        }

        if (line.trim() === '') { out.push('<br/>'); i++; continue; }

        if (PH_RE.test(line)) { out.push(line.trim()); i++; continue; }

        out.push(`<p>${teamsInlineHtml(escapeHtml(line))}</p>`);
        i++;
    }

    return out.join('\n');
}

// ── Markdown → Gmail HTML converter ──────────────────────────────────────────

function toGmailHtml(text: string): string {
    const lines = text.split('\n');
    const out: string[] = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];

        // Pre-formatted placeholder — pass through as block element
        if (SINGLE_PH_RE.test(line.trim())) {
            out.push(line.trim());
            i++;
            continue;
        }

        if (/^---+$/.test(line)) {
            out.push('<hr style="border:none;border-top:1px solid #e2e8f0;margin:12px 0"/>');
            i++; continue;
        }

        const hMatch = line.match(/^(#{1,6})\s+(.+)$/);
        if (hMatch) {
            const level = hMatch[1].length;
            const styles: Record<number, string> = {
                1: 'font-size:22px;font-weight:700;margin:16px 0 8px',
                2: 'font-size:18px;font-weight:700;margin:14px 0 6px',
                3: 'font-size:15px;font-weight:700;margin:12px 0 4px',
                4: 'font-size:13px;font-weight:700;margin:10px 0 4px',
                5: 'font-size:12px;font-weight:700;margin:8px 0 2px',
                6: 'font-size:11px;font-weight:700;margin:6px 0 2px',
            };
            out.push(`<h${level} style="${styles[level] ?? ''}">${inlineHtml(escapeHtml(hMatch[2]))}</h${level}>`);
            i++; continue;
        }

        if (/^>\s?/.test(line)) {
            const items: string[] = [];
            while (i < lines.length && /^>\s?/.test(lines[i])) {
                items.push(inlineHtml(escapeHtml(lines[i].replace(/^>\s?/, ''))));
                i++;
            }
            out.push(`<blockquote style="border-left:4px solid #cbd5e1;margin:8px 0;padding:4px 12px;color:#64748b">${items.join('<br/>')}</blockquote>`);
            continue;
        }

        if (/^[-*]\s+/.test(line)) {
            const items: string[] = [];
            while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
                items.push(`<li>${inlineHtml(escapeHtml(lines[i].replace(/^[-*]\s+/, '')))}</li>`);
                i++;
            }
            out.push(`<ul style="margin:6px 0;padding-left:20px">${items.join('')}</ul>`);
            continue;
        }

        if (/^\d+\.\s+/.test(line)) {
            const items: string[] = [];
            while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
                items.push(`<li>${inlineHtml(escapeHtml(lines[i].replace(/^\d+\.\s+/, '')))}</li>`);
                i++;
            }
            out.push(`<ol style="margin:6px 0;padding-left:20px">${items.join('')}</ol>`);
            continue;
        }

        if (line.trim() === '') { out.push('<br/>'); i++; continue; }

        // Check for inline placeholders (placeholder inside a paragraph)
        if (PH_RE.test(line)) {
            // Treat the whole line as a passthrough — substitution will inject HTML
            out.push(line.trim());
            i++; continue;
        }

        out.push(`<p style="margin:4px 0;line-height:1.6">${inlineHtml(escapeHtml(line))}</p>`);
        i++;
    }

    return `<div style="font-family:Arial,sans-serif;font-size:14px;color:#1e293b;line-height:1.6">${out.join('\n')}</div>`;
}

// ── Markdown → Google Docs plain text converter ───────────────────────────────

function toGDocsPlain(text: string): string {
    const lines = text.split('\n');
    const out: string[] = [];

    for (const raw of lines) {
        let l = raw;
        if (SINGLE_PH_RE.test(l.trim())) { out.push(l); continue; }

        const hMatch = l.match(/^(#{1,6})\s+(.+)$/);
        if (hMatch) {
            const title = hMatch[2];
            const underline = hMatch[1].length === 1 ? '═'.repeat(title.length) : '─'.repeat(title.length);
            out.push(title, underline);
            continue;
        }

        l = l.replace(/^---+$/, '─'.repeat(40));
        l = l.replace(/^[-*]\s+(.+)$/, '  • $1');
        l = l.replace(/\*\*(.+?)\*\*/g, '$1');
        l = l.replace(/\*(.+?)\*/g, '$1');
        l = l.replace(/_(.+?)_/g, '$1');
        l = l.replace(/^>\s?(.+)$/, '  | $1');
        l = l.replace(/`(.+?)`/g, '$1');

        out.push(l);
    }

    return out.join('\n');
}

// ── Executor ──────────────────────────────────────────────────────────────────

export class MessageFormatterNode implements NodeExecutor {
    private resolver = new ExpressionResolver();

    async execute(
        node: WorkflowNode,
        context: ExecutionContext,
    ): Promise<{ formattedText: string; medium: FormatterMedium; teamsLayout?: TeamsLayout; gmailLayout?: GmailLayout }> {
        if (!isMessageFormatterConfig(node.config)) {
            throw new Error(
                `Node "${node.id}" has an invalid or incomplete Message Formatter config. ` +
                `Expected: { medium: 'slack' | 'teams' | 'gmail' | 'gdocs', template: string }`,
            );
        }

        const { medium, template, teamsLayout = 'table', gmailLayout = 'table' } = node.config;

        // ── Step 1: Replace each {{expression}} with a unique placeholder.
        //   Objects/arrays are formatted immediately into medium-specific text.
        //   Primitives are kept as plain strings so the markdown converter can
        //   still process them as part of surrounding template text.
        const placeholders = new Map<string, string>();

        const withPlaceholders = template.replace(/\{\{\s*(.+?)\s*\}\}/g, (_match, expr) => {
            const ph = `${PH_PREFIX}${placeholders.size}${PH_SUFFIX}`;
            try {
                const value = this.resolver.resolve(expr.trim(), context);

                if (value !== null && value !== undefined && typeof value === 'object') {
                    // Format objects/arrays directly into the target medium
                    let formatted: string;
                    switch (medium) {
                        case 'slack':  formatted = slackValue(value);  break;
                        case 'teams':  formatted = teamsLayout === 'text'
                                           ? teamsValueText(value)
                                           : teamsValue(value);        break;
                        case 'gmail':  formatted = gmailLayout === 'text'
                                           ? gmailValueText(value)
                                           : gmailValue(value);        break;
                        case 'gdocs':  formatted = gdocsValueText(value);  break;
                    }
                    placeholders.set(ph, formatted);
                } else {
                    // Primitive — keep as plain text so it merges with surrounding markdown
                    const str = value === null || value === undefined ? '' : String(value);
                    placeholders.set(ph, str);
                }
            } catch {
                placeholders.set(ph, `[missing: ${expr.trim()}]`);
            }
            return ph;
        });

        // ── Step 2: Apply the markdown → medium syntax converter to the template
        //   text (placeholders are ignored by each converter).
        let result: string;
        switch (medium) {
            case 'slack':  result = toSlackMrkdwn(withPlaceholders);   break;
            case 'teams':  result = toTeamsHtml(withPlaceholders);      break;
            case 'gmail':  result = toGmailHtml(withPlaceholders);      break;
            case 'gdocs':  result = toGDocsPlain(withPlaceholders);     break;
        }

        // ── Step 3: Restore placeholder values into the final output.
        for (const [ph, formatted] of placeholders) {
            result = result.split(ph).join(formatted);
        }

        return {
            formattedText: result,
            medium,
            ...(medium === 'teams' ? { teamsLayout } : {}),
            ...(medium === 'gmail' ? { gmailLayout } : {}),
        };
    }
}
