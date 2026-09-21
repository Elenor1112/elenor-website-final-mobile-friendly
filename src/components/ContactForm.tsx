'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { submitLead, type LeadState } from '@/app/(site)/contact/actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary w-full disabled:opacity-60 sm:w-auto">
      {pending ? 'Sending…' : 'Send message →'}
    </button>
  );
}

// text-base below md, text-sm from md up: iOS Safari zooms the page in when a
// focused field's text is under 16px, which on a phone leaves the form
// half-off-screen mid-fill. Desktop keeps the 14px it was designed with.
const field =
  'w-full rounded-xl border border-white/12 bg-white/[0.03] px-4 py-3 text-base md:text-sm text-white placeholder-white/30 outline-none transition-colors focus:border-brand-glow focus:bg-white/[0.05]';

export function ContactForm({
  services,
  budgets,
}: {
  services: { slug: string; name: string }[];
  budgets: string[];
}) {
  const [state, action] = useFormState<LeadState, FormData>(submitLead, null);

  return (
    <form action={action} className="grid gap-4">
      {/* Honeypot — hidden from users, catches bots */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-xs text-white/50">Name *</span>
          <input name="name" required className={field} placeholder="Your name" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs text-white/50">Company *</span>
          <input name="company" required className={field} placeholder="Company name" />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-xs text-white/50">Email *</span>
          <input name="email" type="email" required className={field} placeholder="you@company.com" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs text-white/50">Phone *</span>
          <input name="phone" required className={field} placeholder="+20 …" />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-xs text-white/50">Role *</span>
          <input name="role" required className={field} placeholder="e.g. Marketing Manager" />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-xs text-white/50">Service interest</span>
          <select name="service" className={field} defaultValue="">
            <option value="" className="bg-ink">Select a service</option>
            {services.map((s) => (
              <option key={s.slug} value={s.name} className="bg-ink">
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs text-white/50">Budget range</span>
          <select name="budget" className={field} defaultValue="">
            <option value="" className="bg-ink">Optional</option>
            {budgets.map((b) => (
              <option key={b} value={b} className="bg-ink">
                {b}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-xs text-white/50">Message *</span>
        <textarea
          name="message"
          required
          rows={5}
          className={field}
          placeholder="Tell us about your business and what you’re trying to achieve."
        />
      </label>

      <div className="flex flex-wrap items-center gap-4">
        <SubmitButton />
        {state && (
          <p
            role="status"
            className={`text-sm ${state.ok ? 'text-brand-cyan' : 'text-brand-amber'}`}
          >
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}
