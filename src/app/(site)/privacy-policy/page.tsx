import type { Metadata } from 'next';
import { PageShell } from '@/components/PageShell';
import { getSiteSettings } from '@/lib/data/settings';
import { hubPageMetadata } from '@/lib/data/seo';

export function generateMetadata(): Promise<Metadata> {
  return hubPageMetadata('privacy-policy', {
    title: 'Privacy Policy',
    description:
      'How Elenor Marketing Agency collects, uses, shares, and protects personal data from its website, contact form, and AI assistant.',
    canonical: '/privacy-policy',
  });
}

const LAST_UPDATED = '2 November 2026';

const linkClass = 'text-brand-glow underline underline-offset-4 hover:text-white';

export default async function PrivacyPolicyPage() {
  const site = await getSiteSettings();
  const email = (
    <a href={`mailto:${site.email}`} className={linkClass}>
      {site.email}
    </a>
  );

  return (
    <>
      <PageShell
        eyebrow="Legal"
        title="Privacy Policy"
        lede={`This policy explains what personal data ${site.name} collects through this website, why we collect it, who we share it with, and the choices you have.`}
        crumbs={[{ name: 'Privacy Policy', path: '/privacy-policy' }]}
      >
        <p className="mt-6 text-sm text-white/40">Last updated: {LAST_UPDATED}</p>
      </PageShell>

      <section className="py-20 max-md:py-12">
        <div className="container-x">
          <div className="max-w-3xl space-y-12 text-base leading-relaxed text-white/70 max-md:space-y-10">
            <Block title="Who we are">
              <p>
                {site.name} (“Elenor”, “we”, “us”) is a marketing and brand agency based at{' '}
                {site.address.street}, {site.address.locality}, {site.address.region},{' '}
                {site.address.countryName}. We are responsible for the personal data described in
                this policy. It covers this website only. Work we do for clients is governed by
                our agreements with them.
              </p>
            </Block>

            <Block title="What we collect">
              <p>
                <strong className="text-white">Contact form.</strong> Your name, email address,
                company, phone number, and role, the service and budget you select, and your
                message.
              </p>
              <p>
                <strong className="text-white">AI assistant.</strong> The messages you send, the
                replies you receive, and the page you were on when the conversation started. If
                you mention details such as your name, email address, phone number, company,
                website, industry, budget, timeline, or the services you need, we automatically
                extract them from your messages and save them as a sales lead with a priority
                score. Please don’t share sensitive information in the chat.
              </p>
              <p>
                <strong className="text-white">Technical data.</strong> Your IP address is used to
                limit abuse of the contact form and AI assistant. Our hosting infrastructure may
                also process standard request data, such as your IP address and browser type, in
                order to deliver the site.
              </p>
              <p>
                <strong className="text-white">Analytics and advertising data.</strong> When
                enabled, the tools described under “Cookies and similar technologies” collect data
                about your device and how you use the site.
              </p>
            </Block>

            <Block title="How we use your data">
              <ul className="list-disc space-y-2 pl-5 marker:text-white/30">
                <li>To reply to your enquiry and discuss or provide our services.</li>
                <li>To answer your questions through the AI assistant and continue your conversation when you return.</li>
                <li>To identify and prioritize potential clients, and to follow up with you about your enquiry.</li>
                <li>To review conversations and common questions so we can improve the assistant and our content.</li>
                <li>To measure site performance and the effectiveness of our marketing.</li>
                <li>To keep the site secure, prevent spam and abuse, and meet our legal obligations.</li>
              </ul>
              <p>
                Where the law requires a legal basis, we rely on the steps needed to respond to
                your request, our legitimate interests in running and promoting our business, our
                legal obligations, or your consent.
              </p>
            </Block>

            <Block title="Who we share it with">
              <p>We do not sell your personal data. We share it only with:</p>
              <ul className="list-disc space-y-2 pl-5 marker:text-white/30">
                <li>
                  <strong className="text-white">AI providers</strong>, such as OpenAI and Google.
                  Your chat messages are sent to them to generate replies and search our content.
                </li>
                <li>
                  <strong className="text-white">Infrastructure providers</strong> that host the
                  site, store our data and files, and deliver our email notifications.
                </li>
                <li>
                  <strong className="text-white">Analytics and advertising platforms</strong>, such
                  as Google, Meta, and TikTok, when those tools are enabled.
                </li>
                <li>
                  <strong className="text-white">Authorities or professional advisers</strong>, when
                  required by law or needed to protect our rights.
                </li>
              </ul>
              <p>
                These providers may process data outside your country, including in the United
                States. Where the law requires it, we take steps to protect data when it is
                transferred internationally.
              </p>
            </Block>

            <Block title="Cookies and similar technologies">
              <p>This site uses the following:</p>
              {/* Rows stack on a phone so the duration column is never scrolled off-screen. */}
              <div>
                <table className="w-full border-collapse text-left text-sm max-md:block">
                  <thead className="max-md:hidden">
                    <tr className="border-b border-white/20 text-white">
                      <th scope="col" className="py-3 pr-4 font-semibold">Name</th>
                      <th scope="col" className="py-3 pr-4 font-semibold">Purpose</th>
                      <th scope="col" className="py-3 font-semibold">Duration</th>
                    </tr>
                  </thead>
                  <tbody className="max-md:block">
                    <StorageRow
                      name="elenor_chat_session"
                      purpose="Cookie that links you to your AI assistant conversation. Set when you send your first message."
                      duration="90 days"
                    />
                    <StorageRow
                      name="elenor-ai:conversation"
                      purpose="Keeps your recent chat messages in your browser."
                      duration="Until cleared"
                    />
                    <StorageRow
                      name="elenor_intro_seen"
                      purpose="Remembers that you have seen the intro animation."
                      duration="Until cleared"
                    />
                    <StorageRow
                      name="elenor_hero_headline_seen"
                      purpose="Plays the homepage headline animation once per visit."
                      duration="Browser session"
                    />
                  </tbody>
                </table>
              </div>
              <p>
                We may also use Google Analytics, Google Tag Manager, the Meta Pixel, and the
                TikTok Pixel. When enabled, these services may set their own cookies and use them
                to measure visits and to build or target advertising audiences. Each provider’s
                privacy policy explains how it handles this data.
              </p>
              <p>
                Videos on this site load from YouTube’s privacy-enhanced domain only after you
                press play. YouTube may then collect data under Google’s privacy policy.
              </p>
              <p>
                You can block or delete cookies and stored site data in your browser settings. If
                you do, the AI assistant won’t remember earlier conversations.
              </p>
            </Block>

            <Block title="How long we keep it">
              <p>
                We keep contact form messages, chat conversations, and leads for as long as we need
                them to handle your enquiry, manage our client relationships, and meet our legal
                obligations, and then delete them. IP address records used to limit abuse are
                routinely deleted after about a day. You can ask us to delete your data sooner
                using the details below.
              </p>
            </Block>

            <Block title="How we protect it">
              <p>
                We protect data with encrypted connections, restricted role-based access to our
                admin system, and hashed chat session tokens. No system is completely secure, so
                we can’t guarantee absolute security.
              </p>
            </Block>

            <Block title="Your rights">
              <p>
                Depending on where you live, including under Egypt’s Personal Data Protection Law
                and the EU and UK GDPR, you may have the right to:
              </p>
              <ul className="list-disc space-y-2 pl-5 marker:text-white/30">
                <li>Access the personal data we hold about you and receive a copy of it.</li>
                <li>Correct or delete your data.</li>
                <li>Object to or restrict how we use it, including for marketing.</li>
                <li>Withdraw your consent, where we rely on it.</li>
                <li>Complain to your local data protection authority.</li>
              </ul>
              <p>To make a request, email {email}. We may need to verify your identity first.</p>
            </Block>

            <Block title="Children">
              <p>
                This site is intended for businesses and is not directed at children. If you
                believe a child has given us personal data, contact us and we will delete it.
              </p>
            </Block>

            <Block title="Changes to this policy">
              <p>
                We may update this policy from time to time. We will post changes on this page and
                update the date at the top.
              </p>
            </Block>

            <Block title="Contact us">
              <p>
                For privacy questions or requests, email {email}, call{' '}
                <a href={`tel:${site.phone}`} className={linkClass}>
                  {site.phoneDisplay}
                </a>
                , or write to {site.name}, {site.address.street}, {site.address.locality},{' '}
                {site.address.region}, {site.address.countryName}.
              </p>
            </Block>
          </div>
        </div>
      </section>
    </>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="font-display text-2xl font-semibold text-white">{title}</h2>
      <div className="mt-4 space-y-4">{children}</div>
    </div>
  );
}

function StorageRow({
  name,
  purpose,
  duration,
}: {
  name: string;
  purpose: string;
  duration: string;
}) {
  return (
    <tr className="border-b border-white/10 align-top max-md:block max-md:py-3">
      <td className="py-3 pr-4 font-mono text-xs text-white/85 max-md:block max-md:break-all max-md:p-0">{name}</td>
      <td className="py-3 pr-4 max-md:mt-1 max-md:block max-md:p-0">{purpose}</td>
      <td className="whitespace-nowrap py-3 max-md:mt-1 max-md:block max-md:p-0 max-md:text-white/50 max-md:before:content-['Duration:_']">{duration}</td>
    </tr>
  );
}
