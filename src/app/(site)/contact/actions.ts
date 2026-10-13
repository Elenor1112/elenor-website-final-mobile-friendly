'use server';

import { headers } from 'next/headers';
import { db } from '@/db';
import { contactMessages } from '@/db/schema';
import { getServices } from '@/lib/data/services';
import { notifyNewLead } from '@/server/mail/notify';
import { clientIp, hitRateLimit } from '@/server/rate-limit';

export type LeadState = { ok: boolean; message: string } | null;

// Server action: validates and persists a lead into the CMS inbox
// (contact_messages), where the team reads, filters, and annotates it.
export async function submitLead(
  _prev: LeadState,
  formData: FormData
): Promise<LeadState> {
  // Caps applied up front so the stored row and the notification email match.
  const field = (key: string, max: number) => String(formData.get(key) ?? '').trim().slice(0, max);
  const name = field('name', 200);
  const email = field('email', 200);
  const company = field('company', 200);
  const phone = field('phone', 50);
  const role = field('role', 100);
  const service = field('service', 100);
  const budget = field('budget', 100);
  const message = field('message', 5000);
  const honeypot = String(formData.get('website') ?? ''); // spam trap

  if (honeypot) return { ok: true, message: 'Thanks — we’ll be in touch.' };

  if (name.length < 2) return { ok: false, message: 'Please enter your name.' };
  if (company.length < 1) return { ok: false, message: 'Please enter your company.' };
  // No commas, quotes or angle brackets: the address becomes the Reply-To header.
  if (!/^[^@\s,;<>"]+@[^@\s,;<>"]+\.[^@\s,;<>"]+$/.test(email))
    return { ok: false, message: 'Please enter a valid email address.' };
  if (phone.length < 1) return { ok: false, message: 'Please enter your phone number.' };
  if (role.length < 1) return { ok: false, message: 'Please enter your role.' };
  const services = await getServices();
  if (service && !services.some((s) => s.name === service))
    return { ok: false, message: 'Please choose a valid service.' };
  if (message.length < 10)
    return { ok: false, message: 'Please tell us a little more (10+ characters).' };

  // Per-IP cap, shared across server instances: stops inbox flooding and
  // abuse of the notification mailbox. Fails open if the database is down,
  // since the insert below would fail anyway.
  const limit = await hitRateLimit(`contact:${clientIp(headers())}`, {
    limit: 5,
    windowMs: 10 * 60 * 1000,
  }).catch(() => null);
  if (limit && !limit.allowed) {
    return { ok: false, message: 'Too many requests. Please try again later, or email us directly.' };
  }

  try {
    await db.insert(contactMessages).values({
      name,
      email,
      company,
      phone,
      role,
      service,
      budget,
      message,
    });
  } catch (err) {
    console.error('[lead] failed to persist', err);
    return {
      ok: false,
      message: 'Something went wrong on our side — please try again, or email us directly.',
    };
  }

  await notifyNewLead({ name, email, company, phone, role, service, budget, message });

  return {
    ok: true,
    message: `Thanks, ${name.split(' ')[0]} — we’ll get back to you within one business day.`,
  };
}
