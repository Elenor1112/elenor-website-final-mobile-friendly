import { z } from 'zod';

// Defaults mirror the original src/content/site.ts values so a missing or
// partial settings row degrades to the launch content instead of crashing.

export const siteSettingsSchema = z.object({
  name: z.string().default('Elenor Marketing Agency'),
  shortName: z.string().default('Elenor'),
  tagline: z.string().default('Where Innovation Meets Quality'),
  url: z.string().default('https://elenor-marketing.com'),
  foundingYear: z.number().default(2021),
  description: z
    .string()
    .default(
      'A full-service marketing and brand agency in Cairo, Egypt — brand identity, social media, video & motion, events, printing, web & app development, and interior design.',
    ),
  email: z.string().default('info@elenor-marketing.com'),
  phone: z.string().default('+201201137373'),
  phoneDisplay: z.string().default('+20 120 113 7373'),
  whatsapp: z.string().default('https://wa.me/201201137373'),
  address: z
    .object({
      street: z.string().default('28 Mohamed Abdel Hady Street'),
      locality: z.string().default('Nasr City'),
      region: z.string().default('Cairo'),
      country: z.string().default('EG'),
      countryName: z.string().default('Egypt'),
    })
    .prefault({}),
  hours: z
    .object({
      days: z.array(z.string()).default(['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday']),
      opens: z.string().default('10:00'),
      closes: z.string().default('6:00'),
    })
    .prefault({}),
  founder: z
    .object({
      name: z.string().default('Emad Samir'),
      jobTitle: z.string().default('CEO & Founder'),
    })
    .prefault({}),
  social: z
    .object({
      facebook: z.string().default('https://www.facebook.com/elenor.marketing'),
      instagram: z.string().default('https://www.instagram.com/elenor.marketing/'),
      linkedin: z.string().default('https://www.linkedin.com/company/elenor-marketing-agency'),
      tiktok: z.string().default('https://www.tiktok.com/@elenor.marketing'),
      youtube: z.string().default('https://www.youtube.com/@elenormarketing6394'),
    })
    .prefault({}),
  featuredClients: z
    .array(z.string())
    .default([
      'Coca-Cola',
      'Saint-Gobain',
      'Duravit',
      'Zoetis',
      'Emaar',
      'ICES',
      'Mediconnect',
      'Marcyrl',
      'IBSA Derma',
      'MMEC',
      'Al-Nesr Al-Jawhari',
      'Videology',
      "Kiro's Tours",
      'H&Z Law Firm',
      'Al-Walid Horse Resort',
      'Pro-Sign',
    ]),
});
export type SiteSettings = z.infer<typeof siteSettingsSchema>;

export const themeSettingsSchema = z.object({
  colors: z
    .object({
      brand: z.string().default('#3ba8b5'),
      brandGlow: z.string().default('#68cad6'),
      brandCyan: z.string().default('#36e0d0'),
      brandAmber: z.string().default('#ffb547'),
      background: z.string().default('#05060a'),
    })
    .prefault({}),
  logoMediaId: z.string().nullable().default(null),
  faviconMediaId: z.string().nullable().default(null),
  ogImageMediaId: z.string().nullable().default(null),
});
export type ThemeSettings = z.infer<typeof themeSettingsSchema>;

export const analyticsSettingsSchema = z.object({
  ga4Id: z.string().default(''),
  gtmId: z.string().default(''),
  metaPixelId: z.string().default(''),
  tiktokPixelId: z.string().default(''),
});
export type AnalyticsSettings = z.infer<typeof analyticsSettingsSchema>;

export const contactSettingsSchema = z.object({
  budgets: z
    .array(z.string())
    .default(['Under EGP 25k', 'EGP 25k–75k', 'EGP 75k–200k', 'EGP 200k+', 'Not sure yet']),
  notifyEmails: z.array(z.string()).default([]),
  mapEmbedSrc: z.string().default(''),
});
export type ContactSettings = z.infer<typeof contactSettingsSchema>;

export const workSettingsSchema = z.object({
  industries: z
    .array(z.string())
    .default([
      'All',
      'Healthcare',
      'Pharmaceuticals',
      'Real Estate & Constructions',
      'FMCG',
      'Food & Beverages',
      'Automotive',
      'Media Production',
      'Law Firms',
      'Institutions',
      'Facility Management',
      'Home Appliances',
      'Hospitality',
      'Industrial',
      'Telecommunications',
    ]),
});
export type WorkSettings = z.infer<typeof workSettingsSchema>;

export const settingsSchemas = {
  site: siteSettingsSchema,
  theme: themeSettingsSchema,
  analytics: analyticsSettingsSchema,
  contact: contactSettingsSchema,
  work: workSettingsSchema,
} as const;

export type SettingsKey = keyof typeof settingsSchemas;
export type SettingsValue<K extends SettingsKey> = z.infer<(typeof settingsSchemas)[K]>;
