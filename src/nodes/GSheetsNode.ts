import { google } from 'googleapis';
import { NodeExecutor } from '../engine/NodeExecutor';
import { WorkflowNode, ExecutionContext } from '../types/workflow.types';
import { GoogleAuthService } from '../services/GoogleAuthService';
import { ExpressionResolver } from '../engine/ExpressionResolver';

type GSheetsAction = 'read' | 'write' | 'append';

interface GSheetsConfig {
    credentialId: string;
    action: GSheetsAction;
    spreadsheetId?: string;
    range?: string;
    // write / append
    values?: unknown;   // 2-D array or expression
    valueInputOption?: 'RAW' | 'USER_ENTERED';
}

export class GSheetsNode implements NodeExecutor {
    private googleAuth: GoogleAuthService;
    private resolver = new ExpressionResolver();

    constructor(googleAuth: GoogleAuthService) {
        this.googleAuth = googleAuth;
    }

    async execute(node: WorkflowNode, context: ExecutionContext): Promise<unknown> {
        const config = node.config as unknown as GSheetsConfig;
        const { credentialId, action } = config;

        if (!credentialId) throw new Error('Google Sheets node: credentialId is required');
        if (!action)       throw new Error('Google Sheets node: action is required');

        const auth   = await this.googleAuth.getAuthenticatedClient(credentialId);
        const sheets = google.sheets({ version: 'v4', auth });

        const spreadsheetId = this.resolver.resolveTemplate(config.spreadsheetId ?? '', context);
        const range         = this.resolver.resolveTemplate(config.range ?? '', context);

        if (!spreadsheetId) throw new Error('Google Sheets: spreadsheetId is required');

        if (action === 'read') {
            if (!range) throw new Error('Google Sheets read: range is required');
            const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
            const rows = res.data.values ?? [];
            // Convert to array of objects using first row as headers
            if (rows.length < 2) {
                return { rows, headers: rows[0] ?? [], data: [] };
            }
            const [headers, ...dataRows] = rows;
            const data = dataRows.map((row) => {
                const obj: Record<string, unknown> = {};
                headers.forEach((h: string, i: number) => { obj[h] = row[i] ?? null; });
                return obj;
            });
            return { rows, headers, data, range: res.data.range };
        }

        if (action === 'write') {
            if (!range) throw new Error('Google Sheets write: range is required');
            const values = this.resolveValues(config.values, context);
            const res = await sheets.spreadsheets.values.update({
                spreadsheetId,
                range,
                valueInputOption: config.valueInputOption ?? 'USER_ENTERED',
                requestBody: { values },
            });
            return {
                updatedRange:  res.data.updatedRange,
                updatedRows:   res.data.updatedRows,
                updatedColumns: res.data.updatedColumns,
                updatedCells:  res.data.updatedCells,
            };
        }

        if (action === 'append') {
            const values = this.resolveValues(config.values, context);
            const appendRange = range || 'Sheet1';
            const res = await sheets.spreadsheets.values.append({
                spreadsheetId,
                range: appendRange,
                valueInputOption: config.valueInputOption ?? 'USER_ENTERED',
                insertDataOption: 'INSERT_ROWS',
                requestBody: { values },
            });
            return {
                spreadsheetId: res.data.spreadsheetId,
                tableRange:    res.data.tableRange,
                updatedRange:  res.data.updates?.updatedRange,
                updatedRows:   res.data.updates?.updatedRows,
                updatedCells:  res.data.updates?.updatedCells,
            };
        }

        throw new Error(`Google Sheets node: unknown action "${action}"`);
    }

    private resolveValues(values: unknown, context: ExecutionContext): unknown[][] {
        // If values is a string expression, resolve it
        if (typeof values === 'string') {
            const resolved = this.resolver.resolve(values, context);
            if (Array.isArray(resolved)) return resolved as unknown[][];
            return [[resolved]];
        }
        if (Array.isArray(values)) return values as unknown[][];
        if (values != null) return [[values]];
        return [[]];
    }
}
