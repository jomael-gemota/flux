/**
 * Shared Flux Workflow email templates.
 *
 * Used by:
 *  - EmailNotificationService  (execution alerts)
 *  - GmailNode send_flux action (user-authored branded emails)
 */

function escHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * Wraps arbitrary body content in the Flux Workflow branded email shell.
 *
 * @param subject  The email subject (shown as the card title inside the email).
 * @param bodyHtml HTML or plain-text body content to embed in the card.
 *                 Plain-text lines are preserved via white-space pre-wrap.
 * @param isHtml   When true, `bodyHtml` is embedded as raw HTML.
 *                 When false, it is escaped and wrapped in a pre-style div.
 */
export function buildFluxMessageHtml(subject: string, bodyHtml: string, isHtml = true): string {
    const appUrl = process.env.APP_URL ?? 'http://localhost:3000';
    const fromName = process.env.SMTP_FROM_NAME ?? 'Flux Workflow';

    const bodySection = isHtml
        ? bodyHtml
        : `<div style="font-size:14px;color:#374151;line-height:1.7;white-space:pre-wrap;">${escHtml(bodyHtml)}</div>`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">

  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f8fafc;">
    <tr><td align="center" style="padding:32px 16px;">

      <!-- Card -->
      <table width="600" cellpadding="0" cellspacing="0" role="presentation"
             style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);max-width:600px;width:100%;">

        <!-- Brand header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1e40af 0%,#3b82f6 100%);padding:20px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <div style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:rgba(255,255,255,0.7);margin-bottom:2px;">
                    ${escHtml(fromName)}
                  </div>
                  <div style="font-size:20px;font-weight:700;color:#ffffff;line-height:1.3;">
                    ${escHtml(subject)}
                  </div>
                </td>
                <td style="text-align:right;vertical-align:middle;">
                  <div style="width:36px;height:36px;background:rgba(255,255,255,0.15);border-radius:8px;display:inline-flex;align-items:center;justify-content:center;">
                    <span style="font-size:18px;">⚡</span>
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Body content -->
        <tr>
          <td style="padding:28px 32px;">
            ${bodySection}
          </td>
        </tr>

        <!-- Divider -->
        <tr>
          <td style="padding:0 32px;">
            <hr style="border:none;border-top:1px solid #f1f5f9;margin:0;" />
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:16px 32px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.6;">
                    Sent via <strong>${escHtml(fromName)}</strong> workflow automation.<br />
                    <a href="${escHtml(appUrl)}" style="color:#3b82f6;text-decoration:none;">Open platform →</a>
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
