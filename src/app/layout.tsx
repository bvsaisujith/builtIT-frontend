import type { Metadata } from 'next';
import { AuthProvider } from '@/lib/auth-context';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import RevealProvider from '@/components/RevealProvider';
import './globals.css';

export const metadata: Metadata = {
  title: 'built IT 2K26 | Future of IT',
  description: 'An internal hackathon for builders shaping the future of IT.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: the inline script below adds a `js` class to <html>
    // before React hydrates (it gates the scroll-reveal styles; no-JS users still
    // see all content because the hidden state only applies under html.js).
    <html lang="en" suppressHydrationWarning>
      <body>
        <script
          dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js');" }}
        />
        <AuthProvider>
          <div className="page-shell">
            <Header />
            <RevealProvider />
            <main className="page-content">{children}</main>
            <Footer />
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
