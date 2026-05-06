import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { sendNotification } from '../backend/lib/sendNotification.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { employeeId, companyId, taskName, startDate, companyName, projectName, projectId, notes } = req.body;
  console.log('[TaskNotif] Request body:', { employeeId, companyId, taskName, startDate, companyName, projectName, hasNotes: !!notes });

  if (!employeeId || !companyId || !taskName || !startDate) {
    console.error('[TaskNotif] Missing required fields:', { employeeId, companyId, taskName, startDate });
    return res.status(400).json({ error: 'employeeId, companyId, taskName, and startDate are required' });
  }

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Format date: "2026-04-30" → "Apr 30, 2026"
  const datePart = startDate.split('T')[0].split(' ')[0];
  const [yr, mo, dy] = datePart.split('-').map(Number);
  const dateStr = new Date(Date.UTC(yr, mo - 1, dy)).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  });

  const jobLabel = projectName || companyName || 'your company';

  // In-app / push message — includes job name, task, date, and note (truncated for push)
  const inAppMessage = notes
    ? `You've been assigned to ${jobLabel} for ${taskName} on ${dateStr}.\nNote: ${notes}`
    : `You've been assigned to ${jobLabel} for ${taskName} on ${dateStr}.`;

  // Look up employee email + name in parallel with push token check
  const [employeeResult, tokenResult] = await Promise.all([
    supabase.from('users').select('email, name').eq('id', employeeId).single(),
    supabase.from('push_tokens').select('token, platform, token_source, is_active').eq('user_id', employeeId),
  ]);

  const employeeEmail = employeeResult.data?.email;
  const employeeName  = employeeResult.data?.name;
  console.log('[TaskNotif] Employee:', employeeName, '|', employeeEmail);
  console.log('[TaskNotif] Push tokens:', JSON.stringify(tokenResult.data));

  // Fire in-app notification + email concurrently
  const tasks: Promise<any>[] = [];

  // ── In-app / push notification ──────────────────────────────────────────────
  tasks.push(
    sendNotification(supabase, {
      userId: employeeId,
      companyId,
      type: 'task-assigned',
      title: 'New Task Assignment',
      message: inAppMessage,
      data: { taskName, startDate, projectName: projectName ?? null, projectId: projectId ?? null },
    }).then(notifId => {
      console.log('[TaskNotif] In-app sent — notifId:', notifId);
      return { channel: 'in-app', success: true, notifId };
    }).catch(err => {
      console.error('[TaskNotif] In-app error:', err.message);
      return { channel: 'in-app', success: false, error: err.message };
    })
  );

  // ── Email via Resend ─────────────────────────────────────────────────────────
  const RESEND_API_KEY      = process.env.RESEND_API_KEY;
  const EMAIL_FROM_ADDRESS  = process.env.EMAIL_FROM_ADDRESS || 'onboarding@resend.dev';
  const EMAIL_FROM_NAME     = process.env.EMAIL_FROM_NAME    || 'Legacy Prime';
  const isRestrictedSender  = EMAIL_FROM_ADDRESS === 'onboarding@resend.dev';

  if (isRestrictedSender) {
    console.warn('[TaskNotif] Using restricted test sender onboarding@resend.dev — email will only reach the Resend account owner. Set EMAIL_FROM_ADDRESS to a verified domain email in Vercel environment variables.');
  }

  if (RESEND_API_KEY && employeeEmail) {
    tasks.push(
      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${EMAIL_FROM_NAME} <${EMAIL_FROM_ADDRESS}>`,
          to: [employeeEmail],
          subject: `New Task Assignment — ${taskName} on ${dateStr}`,
          html: buildAssignmentEmailHtml({
            employeeName: employeeName || 'Team Member',
            taskName,
            dateStr,
            jobLabel,
            notes,
            companyName: companyName || EMAIL_FROM_NAME,
          }),
        }),
      })
        .then(async r => {
          const data = await r.json();
          if (!r.ok) {
            console.error('[TaskNotif] Resend rejected email to', employeeEmail, '—', (data as any).message);
            return { channel: 'email', success: false, error: (data as any).message };
          }
          console.log('[TaskNotif] Email accepted for', employeeEmail, '— id:', (data as any).id, isRestrictedSender ? '(restricted sender — delivery not guaranteed)' : '');
          return { channel: 'email', success: true, messageId: (data as any).id, senderWarning: isRestrictedSender ? 'onboarding@resend.dev only delivers to account owner' : undefined };
        })
        .catch(err => {
          console.error('[TaskNotif] Email fetch error:', err.message);
          return { channel: 'email', success: false, error: err.message };
        })
    );
  } else {
    if (!RESEND_API_KEY) console.warn('[TaskNotif] RESEND_API_KEY not set — skipping email');
    if (!employeeEmail)  console.warn('[TaskNotif] No email on file for employee', employeeId, '— skipping email');
  }

  try {
    const results = await Promise.all(tasks);
    console.log('[TaskNotif] Done:', JSON.stringify(results));
    return res.status(200).json({ success: true, results });
  } catch (error: any) {
    console.error('[TaskNotif] Unexpected error:', error.message, error.stack);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

// ── Email HTML template ────────────────────────────────────────────────────────

function buildAssignmentEmailHtml(params: {
  employeeName: string;
  taskName: string;
  dateStr: string;
  jobLabel: string;
  notes?: string;
  companyName: string;
}): string {
  const { employeeName, taskName, dateStr, jobLabel, notes, companyName } = params;

  const notesBlock = notes
    ? `<div class="card">
        <div class="card-title">Instructions / Notes</div>
        <div class="card-value" style="white-space:pre-line;">${escHtml(notes)}</div>
       </div>`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin:0; padding:0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; background:#f9fafb; }
    .container { max-width:600px; margin:0 auto; background:#ffffff; }
    .header { background:linear-gradient(135deg,#2563eb 0%,#1d4ed8 100%); padding:40px 20px; text-align:center; }
    .header h1 { margin:0; color:#ffffff; font-size:26px; font-weight:700; }
    .header p { color:#dbeafe; margin:8px 0 0; font-size:15px; }
    .content { padding:36px 24px; }
    .greeting { font-size:17px; font-weight:600; color:#0f172a; margin-bottom:6px; }
    .message { font-size:15px; line-height:1.6; color:#374151; margin-bottom:24px; }
    .card { background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:20px; margin-bottom:16px; }
    .card-title { font-size:11px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.6px; margin-bottom:10px; }
    .card-value { font-size:15px; color:#1e293b; line-height:1.5; }
    .detail-row { display:flex; gap:8px; margin-bottom:8px; }
    .detail-label { font-weight:600; color:#475569; min-width:80px; }
    .detail-val { color:#1e293b; }
    .badge { display:inline-block; padding:3px 10px; border-radius:20px; font-size:12px; font-weight:600; background:#dbeafe; color:#1d4ed8; }
    .footer { background:#f1f5f9; padding:28px 20px; text-align:center; border-top:1px solid #e2e8f0; font-size:13px; color:#64748b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>New Task Assignment</h1>
      <p>You have a new job scheduled</p>
    </div>
    <div class="content">
      <p class="greeting">Hi ${escHtml(employeeName)},</p>
      <p class="message">
        You've been assigned to a task by <strong>${escHtml(companyName)}</strong>.
        Please review the details below and make sure you're ready for the scheduled date.
      </p>

      <div class="card">
        <div class="card-title">Assignment Details</div>
        <div class="detail-row">
          <span class="detail-label">Job:</span>
          <span class="detail-val">${escHtml(jobLabel)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Task:</span>
          <span class="detail-val"><strong>${escHtml(taskName)}</strong></span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Date:</span>
          <span class="detail-val"><span class="badge">${escHtml(dateStr)}</span></span>
        </div>
      </div>

      ${notesBlock}

      <p style="font-size:13px;color:#94a3b8;margin-top:24px;">
        If you have any questions, contact your supervisor or reply to this email.
      </p>
    </div>
    <div class="footer">
      <strong>${escHtml(companyName)}</strong><br>Powered by Legacy Prime Workflow Suite
    </div>
  </div>
</body>
</html>`.trim();
}

function escHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
