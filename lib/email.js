import { Resend } from 'resend';

// Email notifications via Resend (same stack as ExpiryDesk).
// Configure in .env.local:
//   RESEND_API_KEY=re_xxxxxxxx
//   EMAIL_FROM="Locum Planner <notifications@yourdomain.co.za>"
//   APP_URL=https://your-deployed-url
// Without RESEND_API_KEY, emails are logged to the server console instead of sent,
// so local development works with no setup.

const FROM = process.env.EMAIL_FROM || 'Locum Planner <onboarding@resend.dev>';
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

let client = null;
function getClient() {
  if (!client && process.env.RESEND_API_KEY) {
    client = new Resend(process.env.RESEND_API_KEY);
  }
  return client;
}

// Fire-and-forget: never blocks or fails the action that triggered it.
export function sendEmail({ to, subject, heading, lines = [], ctaLabel, ctaPath }) {
  if (!to) return;

  const html = renderTemplate({ heading, lines, ctaLabel, ctaPath });
  const resend = getClient();

  if (!resend) {
    console.log(`[email skipped — no RESEND_API_KEY] to=${to} subject="${subject}"`);
    return;
  }

  resend.emails
    .send({ from: FROM, to, subject, html })
    .then((res) => {
      if (res.error) console.error('[resend error]', res.error);
    })
    .catch((err) => console.error('[resend error]', err));
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderTemplate({ heading, lines, ctaLabel, ctaPath }) {
  const body = lines.map((l) => `<p style="margin:0 0 12px;color:#334; font-size:15px;line-height:1.5;">${esc(l)}</p>`).join('');
  const button = ctaLabel && ctaPath
    ? `<a href="${APP_URL}${ctaPath}" style="display:inline-block;background:#0f9d8a;color:#fff;font-weight:600;padding:12px 22px;border-radius:8px;text-decoration:none;margin-top:8px;">${esc(ctaLabel)}</a>`
    : '';
  return `
  <div style="background:#f4f8f7;padding:24px 12px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #dde7e4;border-radius:12px;overflow:hidden;">
      <div style="background:#0f9d8a;color:#fff;padding:16px 20px;font-size:18px;font-weight:700;">💊 Locum Planner</div>
      <div style="padding:24px 20px;">
        <h2 style="margin:0 0 14px;color:#14201d;font-size:19px;">${esc(heading)}</h2>
        ${body}
        ${button}
      </div>
      <div style="padding:14px 20px;border-top:1px solid #dde7e4;color:#5b6b67;font-size:12px;">
        You're receiving this because you have a Locum Planner account.
        Manage notifications in the app.
      </div>
    </div>
  </div>`;
}
