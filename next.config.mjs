/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['three'],
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      // Media library uploads (Vercel Blob).
      { protocol: 'https', hostname: '*.public.blob.vercel-storage.com' },
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // No framing anywhere: blocks clickjacking of the admin UI.
          { key: 'X-Frame-Options', value: 'DENY' },
          // Baseline CSP that leaves script-src alone (analytics and Next's
          // inline scripts would need nonces first): no framing, no plugins,
          // no <base> hijack, forms only post back to this site.
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'",
          },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
      // Admin screens and data exports: never cached by browsers or proxies,
      // never indexed.
      ...['/admin/:path*', '/api/messages/export', '/api/ai/:path*/export'].map((source) => ({
        source,
        headers: [
          { key: 'Cache-Control', value: 'no-store' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      })),
    ];
  },
};

export default nextConfig;
