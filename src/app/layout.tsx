import type { Metadata } from 'next';
import './globals.css';

// Deliberately generic + non-indexable: this server should not announce what it
// is or show up in search. The X-Robots-Tag header (see next.config.mjs) covers
// API/redirect responses that never render this metadata.
export const metadata: Metadata = {
  title: 'Service',
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
