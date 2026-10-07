'use server';

import { db } from '@/db';
import { contactMessages } from '@/db/schema';
import { getServices } from '@/lib/data/services';
import { notifyNewLead } from '@/server/mail/notify';

export type LeadState = { ok: boolean; message: string } | null;

// Server action: validates and persists a lead into the CMS inbox
// (contact_messages), where the team reads, filters, and annotates it.
export async function submitLead(
  _prev: LeadState,
  formData: FormData
): Promise<LeadState> {
  const name = String(formData.get('name') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim();
  const company = String(formData.get('company') ?? '').trim();
  const phone = String(formData.get('phone') ?? '').trim();
  const role = String(formData.get('role') ?? '').trim();
  const service = String(formData.get('service') ?? '').trim();
  const budget = String(formData.get('budget') ?? '').trim();
  const message = String(formData.get('message') ?? '').trim();
  const honeypot = String(formData.get('website') ?? ''); // spam trap

  if (honeypot) return { ok: true, message: 'Thanks — we’ll be in touch.' };

  if (name.length < 2) return { ok: false, message: 'Please enter your name.' };
  if (company.length < 1) return { ok: false, message: 'Please enter your company.' };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    return { ok: false, message: 'Please enter a valid email address.' };
  if (phone.length < 1) return { ok: false, message: 'Please enter your phone number.' };
  if (role.length < 1) return { ok: false, message: 'Please enter your role.' };
  const services = await getServices();
  if (service && !services.some((s) => s.name === service))
    return { ok: false, message: 'Please choose a valid service.' };
  if (message.length < 10)
    return { ok: false, message: 'Please tell us a little more (10+ characters).' };

  try {
    await db.insert(contactMessages).values({
      name: name.slice(0, 200),
      email: email.slice(0, 200),
      company: company.slice(0, 200),
      phone: phone.slice(0, 50),
      role: role.slice(0, 100),
      service: service.slice(0, 100),
      budget: budget.slice(0, 100),
      message: message.slice(0, 5000),
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
