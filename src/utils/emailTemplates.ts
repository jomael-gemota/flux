/**
 * Shared Flux Workflow email templates.
 *
 * Used by:
 *  - EmailNotificationService  (execution alerts)
 *  - GmailNode send_flux action (user-authored branded emails)
 */

import { readFileSync } from 'fs';
import { join } from 'path';

function escHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * Loads the platform logo as a base64 data-URI so it is embedded directly
 * in the email and never blocked by external-image policies.
 * Falls back to an empty string (no image rendered) if the file cannot be found.
 */
function getLogoDataUri(): string {
    const candidates = [
        // Production build: dist/public/logo.png  (from dist/utils/ → ../public/)
        join(__dirname, '../public/logo.png'),
        // Development (tsx): src/utils/ → ../../frontend/public/
        join(__dirname, '../../frontend/public/logo.png'),
        // CWD fallback
        join(process.cwd(), 'frontend/public/logo.png'),
    ];
    for (const p of candidates) {
        try {
            const buf = readFileSync(p);
            return `data:image/png;base64,${buf.toString('base64')}`;
        } catch {
            // try next candidate
        }
    }
    return '';
}

// Cache at module load — reads once per process startup
let _logoDataUri: string | null = null;
/** Returns the platform logo as a base64 data-URI (cached after first read). */
export function logoDataUri(): string {
    if (_logoDataUri === null) _logoDataUri = getLogoDataUri();
    return _logoDataUri;
}

/** Flux brand colors derived from the platform logo. */
export const BRAND = {
    primary: '#6366f1',  // indigo-500 — logo background
    dark:    '#4338ca',  // indigo-700
    light:   '#818cf8',  // indigo-400
} as const;

/**
 * Wraps arbitrary body content in the Flux Workflow branded email shell.
 *
 * @param subject  The email subject (shown as the card title inside the email).
 * @param bodyContent  HTML or plain-text body content to embed in the card.
 * @param isHtml   When true, `bodyContent` is embedded as raw HTML.
 *                 When false, it is escaped and wrapped in a pre-style div.
 */
export function buildFluxMessageHtml(subject: string, bodyContent: string, isHtml = true): string {
    const appUrl   = process.env.APP_URL  ?? 'http://localhost:3000';
    const fromName = process.env.SMTP_FROM_NAME ?? 'Flux Workflow';
    const logo     = logoDataUri();

    // Logo's exact brand colors
    const brandPrimary = '#6366f1';   // indigo-500 — matches logo background
    const brandDark    = '#4338ca';   // indigo-700 — darker anchor for gradient
    const brandLight   = '#818cf8';   // indigo-400 — lighter top edge

    const bodySection = isHtml
        ? bodyContent
        : `<div style="font-size:15px;color:#374151;line-height:1.75;white-space:pre-wrap;">${escHtml(bodyContent)}</div>`;

    const logoImg = logo
        ? `<img src="${logo}" alt="${escHtml(fromName)}" width="40" height="40"
               style="width:40px;height:40px;border-radius:10px;object-fit:contain;display:block;" />`
        : `<div style="width:40px;height:40px;border-radius:10px;background:rgba(255,255,255,0.2);
               display:inline-flex;align-items:center;justify-content:center;font-size:20px;">⚡</div>`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f0f0f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#111827;">

  <!-- Outer wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
         style="background:#f0f0f5;padding:40px 16px;">
    <tr><td align="center">

      <!-- Card -->
      <table width="600" cellpadding="0" cellspacing="0" role="presentation"
             style="background:#ffffff;border-radius:16px;overflow:hidden;
                    box-shadow:0 8px 40px rgba(99,102,241,0.12),0 2px 8px rgba(0,0,0,0.06);
                    max-width:600px;width:100%;">

        <!-- ── Brand header ─────────────────────────────────────────────── -->
        <tr>
          <td style="background:linear-gradient(135deg,${brandLight} 0%,${brandPrimary} 45%,${brandDark} 100%);
                     padding:32px 36px 28px;">

            <!-- Logo row -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="vertical-align:middle;">
                  <table cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="vertical-align:middle;padding-right:12px;">
                        ${logoImg}
                      </td>
                      <td style="vertical-align:middle;">
                        <div style="font-size:13px;font-weight:700;letter-spacing:0.5px;
                                    color:rgba(255,255,255,0.9);line-height:1;">
                          ${escHtml(fromName)}
                        </div>
                        <div style="font-size:10px;color:rgba(255,255,255,0.55);
                                    letter-spacing:1px;text-transform:uppercase;margin-top:2px;">
                          Workflow Automation
                        </div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- Subject / title -->
            <div style="margin-top:24px;padding-top:24px;
                        border-top:1px solid rgba(255,255,255,0.2);">
              <h1 style="margin:0;font-size:24px;font-weight:700;
                          color:#ffffff;line-height:1.3;letter-spacing:-0.3px;">
                ${escHtml(subject)}
              </h1>
            </div>
          </td>
        </tr>

        <!-- ── Body ─────────────────────────────────────────────────────── -->
        <tr>
          <td style="padding:32px 36px 28px;">
            ${bodySection}
          </td>
        </tr>

        <!-- ── Divider ───────────────────────────────────────────────────── -->
        <tr>
          <td style="padding:0 36px;">
            <div style="height:1px;background:linear-gradient(90deg,transparent,#e5e7eb,transparent);"></div>
          </td>
        </tr>

        <!-- ── Footer ───────────────────────────────────────────────────── -->
        <tr>
          <td style="padding:20px 36px 28px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="vertical-align:middle;">
                  <p style="margin:0;font-size:11px;color:#9ca3af;line-height:1.6;">
                    Sent via <strong style="color:#6b7280;">${escHtml(fromName)}</strong> automation platform.
                    &nbsp;·&nbsp;
                    <a href="${escHtml(appUrl)}"
                       style="color:${brandPrimary};text-decoration:none;font-weight:500;">
                      Open platform ↗
                    </a>
                  </p>
                </td>
                <td style="text-align:right;vertical-align:middle;">
                  <div style="width:24px;height:24px;border-radius:6px;
                               background:${brandPrimary};display:inline-block;
                               text-align:center;line-height:24px;font-size:13px;">
                    ${logo
                        ? `<img src="${logo}" alt="" width="24" height="24"
                               style="width:24px;height:24px;border-radius:6px;
                                      object-fit:contain;display:block;" />`
                        : '⚡'
                    }
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

      </table>

      <!-- Bottom padding spacer -->
      <div style="height:32px;"></div>

    </td></tr>
  </table>
</body>
</html>`;
}
