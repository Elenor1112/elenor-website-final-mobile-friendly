import 'server-only';
import nodemailer from 'nodemailer';
import { REQUESTS_EMAIL } from '@/lib/contact';

const LEAD_NOTIFICATION_TO = REQUESTS_EMAIL;

/**
 * Best-effort email notification, sent through the company mailbox's own SMTP
 * server — the lead is already persisted to the CMS inbox before this runs, so
 * missing credentials or a server outage must never fail the submission.
 */
export async function notifyNewLead(lead: {
  name: string;
  email: string;
  company: string;
  phone: string;
  role: string;
  service: string;
  budget: string;
  message: string;
}): Promise<void> {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return;

  try {
    const port = Number(SMTP_PORT) || 465;
    const transport = nodemailer.createTransport({
      host: SMTP_HOST,
      port,
      // 465 is implicit TLS; 587/25 upgrade via STARTTLS.
      secure: port === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
    await transport.sendMail({
      // Most SMTP servers reject a From that isn't the authenticated mailbox.
      from: `Elenor Website <${SMTP_USER}>`,
      to: LEAD_NOTIFICATION_TO,
      replyTo: lead.email,
      subject: `New lead: ${lead.name} (${lead.company})`,
      text: [
        `Name: ${lead.name}`,
        `Company: ${lead.company}`,
        `Email: ${lead.email}`,
        `Phone: ${lead.phone}`,
        `Role: ${lead.role}`,
        `Service: ${lead.service || '—'}`,
        `Budget: ${lead.budget || '—'}`,
        '',
        'Message:',
        lead.message,
      ].join('\n'),
    });
  } catch (err) {
    console.error('[lead] failed to send email notification', err);
  }
}
