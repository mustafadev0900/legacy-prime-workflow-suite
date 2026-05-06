/**
 * check-schedule-reminders
 *
 * Cron: runs daily at 8 AM UTC (vercel.json: "0 8 * * *")
 * Finds every scheduled task whose start_date is tomorrow, has at least one
 * assigned employee, and hasn't been reminded yet — then sends:
 *   ✅ In-app push notification  (via sendNotification)
 *   ✅ Email via Resend API
 *   ⏳ SMS via Twilio (pending 10DLC campaign approval)
 *
 * Reminder is marked sent at the task level (reminder_sent = true) to prevent
 * duplicate firing across multiple cron invocations on the same day.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { applyCors } from './lib/cors.js';
import { sendNotification } from '../backend/lib/sendNotification.js';

export const config = { maxDuration: 30 };

// ─── Types ────────────────────────────────────────────────────────────────────

interface TaskRow {
  id: string;
  category: string;
  start_date: string;
  notes: string | null;
  assigned_employee_ids: string[];
  project_id: string;
  project_name: string;
  company_id: string;
}

interface EmployeeRow {
  id: string;
  name: string;
  email: string | null;
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Validate CRON_SECRET when invoked by Vercel cron (GET)
  if (req.method === 'GET') {
    const secret = process.env.CRON_SECRET;
    if (secret && req.headers['authorization'] !== `Bearer ${secret}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const resendKey   = process.env.RESEND_API_KEY;
  const fromAddress = process.env.EMAIL_FROM_ADDRESS || 'onboarding@resend.dev';
  const fromName    = process.env.EMAIL_FROM_NAME    || 'Legacy Prime';

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('[schedule-reminders] Starting day-before reminder check');

  try {
    // ── 1. Find tasks starting tomorrow that haven't been reminded ─────────
    // Step 1a: scheduled tasks starting tomorrow, not yet reminded, not completed.
    // Attempt the query with reminder_sent filter first. If the migration hasn't
    // been run yet (column missing), fall back gracefully without that filter and
    // rely on the atomic UPDATE below to deduplicate sends.
    let rawTasks: Record<string, unknown>[] | null = null;
    {
      const { data: withFlag, error: withFlagErr } = await supabase
        .from('scheduled_tasks')
        .select('id, category, start_date, notes, assigned_employee_ids, project_id')
        .eq('reminder_sent', false)
        .eq('completed', false)
        .gte('start_date', getTomorrowStart())
        .lt('start_date', getDayAfterTomorrowStart());

      if (withFlagErr) {
        // Migration not yet applied — retry without the reminder_sent filter
        if (withFlagErr.message?.includes('reminder_sent')) {
          console.warn('[schedule-reminders] reminder_sent column missing — run the migration. Proceeding without dedup guard.');
          const { data: withoutFlag, error: fallbackErr } = await supabase
            .from('scheduled_tasks')
            .select('id, category, start_date, notes, assigned_employee_ids, project_id')
            .eq('completed', false)
            .gte('start_date', getTomorrowStart())
            .lt('start_date', getDayAfterTomorrowStart());

          if (fallbackErr) {
            console.error('[schedule-reminders] Fallback query error:', fallbackErr);
            return res.status(500).json({ error: fallbackErr.message });
          }
          rawTasks = withoutFlag;
        } else {
          console.error('[schedule-reminders] Task query error:', withFlagErr);
          return res.status(500).json({ error: withFlagErr.message });
        }
      } else {
        rawTasks = withFlag;
      }
    }

    // Keep only tasks that have at least one assigned employee
    const tasksWithEmployees = (rawTasks ?? []).filter(
      r => Array.isArray(r.assigned_employee_ids) && r.assigned_employee_ids.length > 0
    );

    const tasksToRemind: TaskRow[] = [];

    if (tasksWithEmployees.length > 0) {
      // Step 1b: look up project name + company_id for those tasks
      const projectIds = [...new Set(tasksWithEmployees.map(r => r.project_id))];
      const { data: projects, error: projError } = await supabase
        .from('projects')
        .select('id, name, company_id')
        .in('id', projectIds);

      if (projError) {
        console.error('[schedule-reminders] Project lookup error:', projError);
        return res.status(500).json({ error: projError.message });
      }

      const projectMap = new Map(
        (projects ?? []).map(p => [p.id, { name: p.name as string, company_id: p.company_id as string }])
      );

      for (const row of tasksWithEmployees) {
        const project = projectMap.get(row.project_id);
        if (!project) continue;
        tasksToRemind.push({
          id:                    row.id,
          category:              row.category,
          start_date:            row.start_date,
          notes:                 row.notes,
          assigned_employee_ids: row.assigned_employee_ids,
          project_id:            row.project_id,
          project_name:          project.name,
          company_id:            project.company_id,
        });
      }
    }

    console.log(`[schedule-reminders] Found ${tasksToRemind.length} task(s) to remind`);

    if (!tasksToRemind.length) {
      return res.status(200).json({ success: true, reminded: 0 });
    }

    // ── 2. Collect all unique employee IDs ─────────────────────────────────
    const allEmployeeIds = [
      ...new Set(tasksToRemind.flatMap(t => t.assigned_employee_ids)),
    ];

    const { data: employeeRows, error: empError } = await supabase
      .from('users')
      .select('id, name, email')
      .in('id', allEmployeeIds);

    if (empError) {
      console.error('[schedule-reminders] Employee lookup error:', empError);
      return res.status(500).json({ error: empError.message });
    }

    const employeeMap = new Map<string, EmployeeRow>(
      (employeeRows ?? []).map(e => [e.id, e])
    );

    // ── 3. Process each task ───────────────────────────────────────────────
    let totalNotified = 0;

    for (const task of tasksToRemind) {
      // Atomically claim reminder to prevent double-fire across concurrent cron invocations.
      // If the migration hasn't been applied yet, skip the guard and proceed anyway.
      const { data: claimed, error: claimErr } = await supabase
        .from('scheduled_tasks')
        .update({ reminder_sent: true })
        .eq('id', task.id)
        .eq('reminder_sent', false)
        .select('id');

      const migrationMissing = claimErr?.message?.includes('reminder_sent');
      if (!migrationMissing && !claimed?.length) {
        console.log('[schedule-reminders] Task already claimed, skipping:', task.id);
        continue;
      }

      const dateStr = formatDate(task.start_date);
      const pushMessage = task.notes
        ? `Reminder: ${task.category} at ${task.project_name} on ${dateStr}.\nNote: ${task.notes}`
        : `Reminder: ${task.category} at ${task.project_name} on ${dateStr}.`;

      // Notify each assigned employee in parallel
      await Promise.allSettled(
        task.assigned_employee_ids.map(async (empId) => {
          const employee = employeeMap.get(empId);
          if (!employee) return;

          // In-app push notification
          await sendNotification(supabase, {
            userId:    empId,
            companyId: task.company_id,
            type:      'task-reminder',
            title:     `Task Tomorrow: ${task.category}`,
            message:   pushMessage,
            data: {
              taskId:      task.id,
              projectId:   task.project_id,
              projectName: task.project_name,
              startDate:   task.start_date,
            },
          });

          // Email
          if (resendKey && employee.email?.trim()) {
            await sendReminderEmail({
              resendKey,
              fromAddress,
              fromName,
              employee,
              task,
              dateStr,
            });
          }

          totalNotified++;
          console.log(`[schedule-reminders] Reminded employee ${employee.name} for task "${task.category}"`);
        })
      );
    }

    console.log(`[schedule-reminders] Done — ${tasksToRemind.length} task(s), ${totalNotified} notification(s) sent`);
    return res.status(200).json({
      success: true,
      tasks:   tasksToRemind.length,
      reminded: totalNotified,
    });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[schedule-reminders] Unexpected error:', msg);
    return res.status(500).json({ error: msg });
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getTomorrowStart(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString();
}

function getDayAfterTomorrowStart(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + 2);
  return d.toISOString();
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  // If the time component is not UTC midnight the date was saved as local midnight
  // (legacy bug: setHours instead of setUTCHours). Shift forward one day so we
  // display the user's intended local date, not the UTC date one day earlier.
  if (d.getUTCHours() !== 0 || d.getUTCMinutes() !== 0 || d.getUTCSeconds() !== 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    d.setUTCHours(0, 0, 0, 0);
  }
  return d.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  });
}

// ─── Email ────────────────────────────────────────────────────────────────────

async function sendReminderEmail({
  resendKey,
  fromAddress,
  fromName,
  employee,
  task,
  dateStr,
}: {
  resendKey:   string;
  fromAddress: string;
  fromName:    string;
  employee:    EmployeeRow;
  task:        TaskRow;
  dateStr:     string;
}): Promise<void> {
  const firstName = employee.name?.split(' ')[0] || 'there';
  const subject   = `Reminder: "${task.category}" is tomorrow — ${task.project_name}`;
  const html      = buildReminderEmailHtml({
    firstName,
    projectName: task.project_name,
    taskName:    task.category,
    dateStr,
    notes:       task.notes ?? null,
    companyName: fromName,
  });

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        from:    `${fromName} <${fromAddress}>`,
        to:      [employee.email!],
        subject,
        html,
      }),
    });

    const data = await r.json() as { id?: string; message?: string };
    if (r.ok) {
      console.log(`[schedule-reminders] Email sent to ${employee.email} — id: ${data.id}`);
    } else {
      console.warn(`[schedule-reminders] Email failed for ${employee.email}:`, data.message);
    }
  } catch (err) {
    console.warn(`[schedule-reminders] Email send error for ${employee.email}:`, err);
  }
}

function esc(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildReminderEmailHtml(p: {
  firstName:   string;
  projectName: string;
  taskName:    string;
  dateStr:     string;
  notes:       string | null;
  companyName: string;
}): string {
  const notesBlock = p.notes
    ? `
    <div class="card notes">
      <p class="card-label">Instructions / Notes</p>
      <p class="card-value notes-text">${esc(p.notes).replace(/\n/g, '<br>')}</p>
    </div>`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin:0; padding:0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; background:#f9fafb; }
    .container { max-width:600px; margin:0 auto; background:#fff; }
    .header { background:linear-gradient(135deg,#2563eb,#1d4ed8); padding:36px 24px; text-align:center; }
    .header h1 { margin:0; color:#fff; font-size:22px; font-weight:700; }
    .badge { display:inline-block; background:rgba(255,255,255,0.2); color:#fff; font-size:12px; font-weight:600; letter-spacing:.5px; padding:4px 12px; border-radius:20px; margin-top:10px; text-transform:uppercase; }
    .content { padding:32px 24px 16px; }
    .greeting { font-size:16px; font-weight:600; color:#0f172a; margin:0 0 8px; }
    .intro { font-size:15px; color:#374151; margin:0 0 24px; line-height:1.6; }
    .card { background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:16px 20px; margin-bottom:12px; }
    .card-label { font-size:11px; font-weight:700; color:#64748b; letter-spacing:.5px; text-transform:uppercase; margin:0 0 4px; }
    .card-value { font-size:16px; font-weight:600; color:#0f172a; margin:0; }
    .card.highlight { border-color:#bfdbfe; background:#eff6ff; }
    .card.highlight .card-value { color:#1d4ed8; }
    .card.notes .notes-text { font-size:14px; font-weight:400; color:#374151; line-height:1.6; }
    .footer { background:#f1f5f9; padding:24px; text-align:center; border-top:1px solid #e2e8f0; font-size:13px; color:#64748b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${esc(p.companyName)}</h1>
      <span class="badge">Task Reminder</span>
    </div>
    <div class="content">
      <p class="greeting">Hi ${esc(p.firstName)},</p>
      <p class="intro">This is a reminder that you have a task scheduled for <strong>tomorrow</strong>. Please review the details below and make sure you're prepared.</p>

      <div class="card">
        <p class="card-label">Job / Project</p>
        <p class="card-value">${esc(p.projectName)}</p>
      </div>

      <div class="card">
        <p class="card-label">Task</p>
        <p class="card-value">${esc(p.taskName)}</p>
      </div>

      <div class="card highlight">
        <p class="card-label">Scheduled Date</p>
        <p class="card-value">${esc(p.dateStr)}</p>
      </div>

      ${notesBlock}
    </div>
    <div class="footer">
      <strong>${esc(p.companyName)}</strong><br>Powered by Legacy Prime Workflow Suite
    </div>
  </div>
</body>
</html>`.trim();
}
