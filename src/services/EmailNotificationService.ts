import nodemailer, { type Transporter } from 'nodemailer';
import type { NodeResult } from '../types/workflow.types';
import { NotificationSettingsRepository } from '../repositories/NotificationSettingsRepository';
import { logoDataUri, BRAND } from '../utils/emailTemplates';

export interface ExecutionNotificationPayload {
    executionId: string;
    workflowId: string;
    workflowName: string;
    workflowVersion: number;
    status: 'success' | 'failure' | 'partial';
    triggeredBy: string;
    startedAt: Date;
    completedAt: Date;
    results: NodeResult[];
}

/** @deprecated use ExecutionNotificationPayload */
export type FailureNotificationPayload = ExecutionNotificationPayload;

function isSmtpConfigured(): boolean {
    return !!(
        process.env.SMTP_HOST &&
        process.env.SMTP_USER &&
        process.env.SMTP_PASS &&
        process.env.SMTP_FROM_ADDRESS
    );
}

function createTransporter(): Transporter {
    const port = Number(process.env.SMTP_PORT ?? 587);
    const secure = process.env.SMTP_SECURE === 'true';

    return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port,
        secure,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });
}

// ── HTML template ─────────────────────────────────────────────────────────────

function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    const s = (ms / 1000).toFixed(2);
    return `${s}s`;
}

function statusBadge(status: 'success' | 'failure' | 'skipped'): string {
    const map: Record<string, { bg: string; color: string; label: string }> = {
        success: { bg: '#d1fae5', color: '#065f46', label: 'SUCCESS' },
        failure: { bg: '#fee2e2', color: '#991b1b', label: 'FAILURE' },
        skipped: { bg: '#f1f5f9', color: '#475569', label: 'SKIPPED' },
    };
    const s = map[status] ?? map.failure;
    return `<span style="display:inline-block;padding:2px 8px;border-radius:9999px;background:${s.bg};color:${s.color};font-size:11px;font-weight:700;letter-spacing:0.5px;">${s.label}</span>`;
}

function nodeResultRows(results: NodeResult[]): string {
    return results
        .map((r) => {
            const isRunner = r.nodeId === '__runner__';
            const nodeLabel = isRunner ? '<em>Runner (startup)</em>' : `<code style="background:#f1f5f9;padding:1px 5px;border-radius:3px;font-size:12px;">${escHtml(r.nodeId)}</code>`;
            const errorCell = r.error
                ? `<span style="color:#dc2626;font-family:monospace;font-size:12px;word-break:break-all;">${escHtml(r.error)}</span>`
                : '<span style="color:#94a3b8;">—</span>';
            return `
        <tr style="border-bottom:1px solid #f1f5f9;">
          <td style="padding:10px 12px;vertical-align:top;white-space:nowrap;">${nodeLabel}</td>
          <td style="padding:10px 12px;vertical-align:top;text-align:center;">${statusBadge(r.status)}</td>
          <td style="padding:10px 12px;vertical-align:top;text-align:right;white-space:nowrap;color:#64748b;font-size:12px;">${formatDuration(r.durationMs)}</td>
          <td style="padding:10px 12px;vertical-align:top;">${errorCell}</td>
        </tr>`;
        })
        .join('');
}

function escHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function buildEmailHtml(p: ExecutionNotificationPayload): string {
    const appUrl = process.env.APP_URL ?? 'http://localhost:3000';
    const failedNodes  = p.results.filter((r) => r.status === 'failure');
    const successNodes = p.results.filter((r) => r.status === 'success');
    const skippedNodes = p.results.filter((r) => r.status === 'skipped');
    const wallClock    = p.completedAt.getTime() - p.startedAt.getTime();

    // Status-specific accent color (for the alert strip, not the brand header)
    const statusTheme = {
        success: { accent: '#16a34a', stripBg: '#f0fdf4', stripBorder: '#bbf7d0', label: '✓ Workflow Completed Successfully' },
        partial: { accent: '#c2410c', stripBg: '#fff7ed', stripBorder: '#fed7aa', label: '⚠ Workflow Partially Failed'         },
        failure: { accent: '#dc2626', stripBg: '#fff1f2', stripBorder: '#fecaca', label: '✕ Workflow Failed'                   },
    };
    const theme = statusTheme[p.status] ?? statusTheme.failure;

    const triggeredByLabel: Record<string, string> = {
        api:      'API Call',
        webhook:  'Webhook',
        schedule: 'Scheduled Run',
        manual:   'Manual Trigger',
        replay:   'Execution Replay',
    };

    const localTime = p.startedAt.toLocaleString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        timeZoneName: 'short',
    });

    const logo = logoDataUri();
    const logoImg = logo
        ? `<img src="${logo}" alt="Flux Workflow" width="40" height="40"
               style="width:40px;height:40px;border-radius:10px;object-fit:contain;display:block;" />`
        : `<div style="width:40px;height:40px;border-radius:10px;background:rgba(255,255,255,0.2);
               text-align:center;line-height:40px;font-size:20px;">⚡</div>`;

    const logoSmall = logo
        ? `<img src="${logo}" alt="" width="20" height="20"
               style="width:20px;height:20px;border-radius:5px;object-fit:contain;display:block;" />`
        : '⚡';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Flux Workflow — Execution ${p.status === 'success' ? 'Succeeded' : 'Alert'}</title>
</head>
<body style="margin:0;padding:0;background:#f0f0f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#111827;">

  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
         style="background:#f0f0f5;padding:40px 16px;">
    <tr><td align="center">

      <!-- Card -->
      <table width="600" cellpadding="0" cellspacing="0" role="presentation"
             style="background:#ffffff;border-radius:16px;overflow:hidden;
                    box-shadow:0 8px 40px rgba(99,102,241,0.12),0 2px 8px rgba(0,0,0,0.06);
                    max-width:600px;width:100%;">

        <!-- ── Brand header (always indigo — platform identity) ─────── -->
        <tr>
          <td style="background:linear-gradient(135deg,${BRAND.light} 0%,${BRAND.primary} 45%,${BRAND.dark} 100%);
                     padding:32px 36px 28px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="vertical-align:middle;">
                  <table cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="vertical-align:middle;padding-right:12px;">${logoImg}</td>
                      <td style="vertical-align:middle;">
                        <div style="font-size:14px;font-weight:700;color:rgba(255,255,255,0.95);line-height:1;">
                          Flux Workflow
                        </div>
                        <div style="font-size:10px;color:rgba(255,255,255,0.55);letter-spacing:1px;text-transform:uppercase;margin-top:2px;">
                          Execution Alert
                        </div>
                      </td>
                    </tr>
                  </table>
                </td>
                <td style="text-align:right;vertical-align:middle;">
                  <div style="font-size:11px;color:rgba(255,255,255,0.5);font-family:monospace;">
                    v${p.workflowVersion}
                  </div>
                </td>
              </tr>
            </table>

            <!-- Workflow name + status label -->
            <div style="margin-top:24px;padding-top:24px;border-top:1px solid rgba(255,255,255,0.2);">
              <div style="font-size:11px;font-weight:600;color:rgba(255,255,255,0.6);
                          text-transform:uppercase;letter-spacing:0.8px;margin-bottom:6px;">
                ${escHtml(p.workflowName)}
              </div>
              <h1 style="margin:0;font-size:24px;font-weight:700;color:#ffffff;line-height:1.3;letter-spacing:-0.3px;">
                ${theme.label}
              </h1>
            </div>
          </td>
        </tr>

        <!-- ── Status strip (color-coded by outcome) ───────────────── -->
        <tr>
          <td style="background:${theme.stripBg};padding:14px 36px;border-bottom:1px solid ${theme.stripBorder};">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="font-size:13px;color:${theme.accent};font-weight:600;">
                  ${p.status === 'failure' ? `${failedNodes.length} node${failedNodes.length !== 1 ? 's' : ''} failed` :
                    p.status === 'partial' ? `${failedNodes.length} of ${p.results.length} nodes failed` :
                    `All ${successNodes.length} nodes completed successfully`}
                </td>
                <td style="text-align:right;font-size:12px;color:${theme.accent};opacity:0.75;">
                  ${formatDuration(wallClock)} total
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ── Summary grid ─────────────────────────────────────────── -->
        <tr>
          <td style="padding:28px 36px 0;">
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
              <tr style="background:#f9fafb;">
                <td style="padding:12px 16px;border-right:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;">
                  <div style="font-size:10px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:#9ca3af;margin-bottom:4px;">Workflow</div>
                  <div style="font-size:13px;font-weight:600;color:#111827;">${escHtml(p.workflowName)}</div>
                </td>
                <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;">
                  <div style="font-size:10px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:#9ca3af;margin-bottom:4px;">Status</div>
                  <div style="font-size:13px;font-weight:700;color:${theme.accent};">${p.status.toUpperCase()}</div>
                </td>
              </tr>
              <tr style="background:#ffffff;">
                <td style="padding:12px 16px;border-right:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;">
                  <div style="font-size:10px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:#9ca3af;margin-bottom:4px;">Date &amp; Time</div>
                  <div style="font-size:13px;color:#111827;">${localTime}</div>
                </td>
                <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;">
                  <div style="font-size:10px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:#9ca3af;margin-bottom:4px;">Triggered By</div>
                  <div style="font-size:13px;color:#111827;">${escHtml(triggeredByLabel[p.triggeredBy] ?? p.triggeredBy)}</div>
                </td>
              </tr>
              <tr style="background:#f9fafb;">
                <td style="padding:12px 16px;border-right:1px solid #e5e7eb;">
                  <div style="font-size:10px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:#9ca3af;margin-bottom:4px;">Workflow ID</div>
                  <div style="font-size:12px;font-family:monospace;color:#6b7280;word-break:break-all;">${escHtml(p.workflowId)}</div>
                </td>
                <td style="padding:12px 16px;">
                  <div style="font-size:10px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:#9ca3af;margin-bottom:4px;">Execution ID</div>
                  <div style="font-size:12px;font-family:monospace;color:#6b7280;word-break:break-all;">${escHtml(p.executionId)}</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ── Stats row ────────────────────────────────────────────── -->
        <tr>
          <td style="padding:16px 36px 0;">
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
              <tr>
                <td style="padding:14px 12px;text-align:center;border-right:1px solid #e5e7eb;">
                  <div style="font-size:22px;font-weight:700;color:#dc2626;">${failedNodes.length}</div>
                  <div style="font-size:10px;color:#9ca3af;margin-top:2px;text-transform:uppercase;letter-spacing:0.5px;">Failed</div>
                </td>
                <td style="padding:14px 12px;text-align:center;border-right:1px solid #e5e7eb;">
                  <div style="font-size:22px;font-weight:700;color:#16a34a;">${successNodes.length}</div>
                  <div style="font-size:10px;color:#9ca3af;margin-top:2px;text-transform:uppercase;letter-spacing:0.5px;">Succeeded</div>
                </td>
                <td style="padding:14px 12px;text-align:center;border-right:1px solid #e5e7eb;">
                  <div style="font-size:22px;font-weight:700;color:#9ca3af;">${skippedNodes.length}</div>
                  <div style="font-size:10px;color:#9ca3af;margin-top:2px;text-transform:uppercase;letter-spacing:0.5px;">Skipped</div>
                </td>
                <td style="padding:14px 12px;text-align:center;border-right:1px solid #e5e7eb;">
                  <div style="font-size:22px;font-weight:700;color:#374151;">${p.results.length}</div>
                  <div style="font-size:10px;color:#9ca3af;margin-top:2px;text-transform:uppercase;letter-spacing:0.5px;">Total</div>
                </td>
                <td style="padding:14px 12px;text-align:center;">
                  <div style="font-size:22px;font-weight:700;color:#374151;">${formatDuration(wallClock)}</div>
                  <div style="font-size:10px;color:#9ca3af;margin-top:2px;text-transform:uppercase;letter-spacing:0.5px;">Duration</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ── Failed nodes section ─────────────────────────────────── -->
        ${failedNodes.length > 0 ? `
        <tr>
          <td style="padding:24px 36px 0;">
            <div style="font-size:12px;font-weight:700;color:#dc2626;margin-bottom:10px;
                        text-transform:uppercase;letter-spacing:0.5px;">
              ✕ Failed Nodes (${failedNodes.length})
            </div>
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="border:1px solid #fecaca;border-radius:10px;overflow:hidden;">
              <thead>
                <tr style="background:#fef2f2;">
                  <th style="padding:10px 12px;text-align:left;font-size:10px;font-weight:700;color:#9ca3af;letter-spacing:0.5px;text-transform:uppercase;border-bottom:1px solid #fecaca;">Node ID</th>
                  <th style="padding:10px 12px;text-align:center;font-size:10px;font-weight:700;color:#9ca3af;letter-spacing:0.5px;text-transform:uppercase;border-bottom:1px solid #fecaca;">Status</th>
                  <th style="padding:10px 12px;text-align:right;font-size:10px;font-weight:700;color:#9ca3af;letter-spacing:0.5px;text-transform:uppercase;border-bottom:1px solid #fecaca;">Duration</th>
                  <th style="padding:10px 12px;text-align:left;font-size:10px;font-weight:700;color:#9ca3af;letter-spacing:0.5px;text-transform:uppercase;border-bottom:1px solid #fecaca;">Error Message</th>
                </tr>
              </thead>
              <tbody>${nodeResultRows(failedNodes)}</tbody>
            </table>
          </td>
        </tr>` : ''}

        <!-- ── Full execution log ───────────────────────────────────── -->
        <tr>
          <td style="padding:24px 36px 0;">
            <div style="font-size:12px;font-weight:700;color:#374151;margin-bottom:10px;
                        text-transform:uppercase;letter-spacing:0.5px;">Full Execution Log</div>
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
              <thead>
                <tr style="background:#f9fafb;">
                  <th style="padding:10px 12px;text-align:left;font-size:10px;font-weight:700;color:#9ca3af;letter-spacing:0.5px;text-transform:uppercase;border-bottom:1px solid #e5e7eb;">Node ID</th>
                  <th style="padding:10px 12px;text-align:center;font-size:10px;font-weight:700;color:#9ca3af;letter-spacing:0.5px;text-transform:uppercase;border-bottom:1px solid #e5e7eb;">Status</th>
                  <th style="padding:10px 12px;text-align:right;font-size:10px;font-weight:700;color:#9ca3af;letter-spacing:0.5px;text-transform:uppercase;border-bottom:1px solid #e5e7eb;">Duration</th>
                  <th style="padding:10px 12px;text-align:left;font-size:10px;font-weight:700;color:#9ca3af;letter-spacing:0.5px;text-transform:uppercase;border-bottom:1px solid #e5e7eb;">Error</th>
                </tr>
              </thead>
              <tbody>${nodeResultRows(p.results)}</tbody>
            </table>
          </td>
        </tr>

        <!-- ── CTA button ───────────────────────────────────────────── -->
        <tr>
          <td style="padding:28px 36px;">
            <table cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td style="border-radius:8px;background:${BRAND.primary};">
                  <a href="${escHtml(appUrl)}"
                     style="display:inline-block;padding:12px 24px;color:#ffffff;
                            font-size:13px;font-weight:600;text-decoration:none;border-radius:8px;">
                    Open Flux Workflow ↗
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ── Footer ──────────────────────────────────────────────── -->
        <tr>
          <td style="padding:0 36px;">
            <div style="height:1px;background:linear-gradient(90deg,transparent,#e5e7eb,transparent);"></div>
          </td>
        </tr>
        <tr>
          <td style="padding:18px 36px 26px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="vertical-align:middle;">
                  <p style="margin:0;font-size:11px;color:#9ca3af;line-height:1.6;">
                    This alert was sent automatically by <strong style="color:#6b7280;">Flux Workflow</strong>.<br />
                    To manage notification settings, open the platform and go to
                    <strong>Notifications</strong> in the toolbar.
                  </p>
                </td>
                <td style="text-align:right;vertical-align:middle;padding-left:12px;">
                  <div style="width:24px;height:24px;border-radius:6px;overflow:hidden;display:inline-block;">
                    ${logoSmall}
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

      </table>

      <div style="height:32px;"></div>
    </td></tr>
  </table>
</body>
</html>`;
}

function buildEmailText(p: ExecutionNotificationPayload): string {
    const failedNodes = p.results.filter((r) => r.status === 'failure');
    const localTime = p.startedAt.toLocaleString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        timeZoneName: 'short',
    });
    const wallClock = p.completedAt.getTime() - p.startedAt.getTime();

    const lines: string[] = [
        `Flux Workflow — Execution ${p.status.toUpperCase()}`,
        '='.repeat(50),
        '',
        `Workflow:      ${p.workflowName} (v${p.workflowVersion})`,
        `Workflow ID:   ${p.workflowId}`,
        `Execution ID:  ${p.executionId}`,
        `Status:        ${p.status.toUpperCase()}`,
        `Triggered By:  ${p.triggeredBy}`,
        `Date & Time:   ${localTime}`,
        `Duration:      ${formatDuration(wallClock)}`,
        '',
        `Nodes — Failed: ${failedNodes.length}, Succeeded: ${p.results.filter(r => r.status === 'success').length}, Skipped: ${p.results.filter(r => r.status === 'skipped').length}, Total: ${p.results.length}`,
        '',
    ];

    if (failedNodes.length > 0) {
        lines.push('FAILED NODES');
        lines.push('-'.repeat(40));
        for (const n of failedNodes) {
            lines.push(`  Node: ${n.nodeId}`);
            lines.push(`  Duration: ${formatDuration(n.durationMs)}`);
            lines.push(`  Error: ${n.error ?? 'unknown'}`);
            lines.push('');
        }
    }

    lines.push('FULL EXECUTION LOG');
    lines.push('-'.repeat(40));
    for (const r of p.results) {
        lines.push(`  ${r.nodeId.padEnd(30)} ${r.status.toUpperCase().padEnd(10)} ${formatDuration(r.durationMs)}${r.error ? `  ← ${r.error}` : ''}`);
    }

    return lines.join('\n');
}

// ── Service ───────────────────────────────────────────────────────────────────

export class EmailNotificationService {
    private settingsRepo: NotificationSettingsRepository;

    constructor(settingsRepo: NotificationSettingsRepository) {
        this.settingsRepo = settingsRepo;
    }

    /** Returns whether SMTP env vars are fully configured */
    static isConfigured(): boolean {
        return isSmtpConfigured();
    }

    /** Send a test email to verify SMTP config */
    async sendTestEmail(recipient: string): Promise<void> {
        if (!isSmtpConfigured()) {
            throw new Error('SMTP is not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS, and SMTP_FROM_ADDRESS in your environment.');
        }

        const transporter = createTransporter();
        const from = `"${process.env.SMTP_FROM_NAME ?? 'Flux Workflow'}" <${process.env.SMTP_FROM_ADDRESS}>`;

        const { buildFluxMessageHtml } = await import('../utils/emailTemplates');
        const testHtml = buildFluxMessageHtml(
            'Test Email Successful',
            `<p style="font-size:15px;color:#374151;margin:0 0 16px;">
               Your <strong>Flux Workflow</strong> email notification settings are working correctly.
             </p>
             <p style="font-size:14px;color:#6b7280;margin:0;">
               You will receive alerts at this address whenever a workflow run matches your configured conditions.
             </p>`,
            true,
        );
        await transporter.sendMail({
            from,
            to: recipient,
            subject: '✅ Flux Workflow — Test Email',
            text: 'This is a test email from Flux Workflow. Your email notification settings are working correctly.',
            html: testHtml,
        });
    }

    /** Called after every execution completes — sends alert if conditions are met */
    async notifyOnCompletion(payload: ExecutionNotificationPayload): Promise<void> {
        const settings = await this.settingsRepo.get();

        if (!settings.enabled) return;
        if (!settings.recipients.length) return;
        if (payload.status === 'failure' && !settings.notifyOnFailure) return;
        if (payload.status === 'partial' && !settings.notifyOnPartial) return;
        if (payload.status === 'success' && !settings.notifyOnSuccess) return;

        if (!isSmtpConfigured()) {
            console.warn('[EmailNotification] SMTP not configured — skipping notification for execution', payload.executionId);
            return;
        }

        try {
            const transporter = createTransporter();
            const from = `"${process.env.SMTP_FROM_NAME ?? 'Flux Workflow'}" <${process.env.SMTP_FROM_ADDRESS}>`;
            const subjectPrefix =
                payload.status === 'success'  ? '✓ Success'        :
                payload.status === 'partial'  ? '⚠ Partial Failure' :
                                               '✕ Workflow Failed';

            await transporter.sendMail({
                from,
                to: settings.recipients.join(', '),
                subject: `${subjectPrefix}: ${payload.workflowName}`,
                text: buildEmailText(payload),
                html: buildEmailHtml(payload),
            });

            console.log(`[EmailNotification] Alert sent for execution ${payload.executionId} (${payload.status}) to ${settings.recipients.length} recipient(s)`);
        } catch (err) {
            console.error('[EmailNotification] Failed to send notification email:', err);
        }
    }
}
