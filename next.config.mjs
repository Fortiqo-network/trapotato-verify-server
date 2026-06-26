/** @type {import('next').NextConfig} */
const nextConfig = {
  // Produce a self-contained server bundle for Docker / PM2 deployment.
  output: 'standalone',
  // The pg driver is a native Node module — keep it external to the bundle.
  serverExternalPackages: ['pg'],
  eslint: {
    // Linting is run separately; do not block production builds on it.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
