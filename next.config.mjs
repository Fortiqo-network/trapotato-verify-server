/** @type {import('next').NextConfig} */
const nextConfig = {
  // `output: 'standalone'` is ONLY for the self-hosted (PM2/Docker) deploy.
  // Vercel builds Next.js natively and sets VERCEL=1, so we drop standalone
  // there. This lets the self-hosted box and Vercel run the same code during
  // the migration.
  output: process.env.VERCEL ? undefined : 'standalone',

  // The pg driver is a native Node module — keep it external to the bundle.
  serverExternalPackages: ['pg'],

  // Don't advertise the framework (reduces fingerprinting of this server).
  poweredByHeader: false,

  eslint: {
    // Linting is run separately; do not block production builds on it.
    ignoreDuringBuilds: true,
  },

  // Keep this server out of search engines and archives without shipping a
  // robots.txt / sitemap (nothing to enumerate). Applied to every route.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive, nosnippet, noimageindex' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ];
  },
};

export default nextConfig;
