import type { Metadata, Viewport } from 'next';
import './globals.css';
import { SectionProvider } from '../context/SectionContext';
import { RegisterSW } from './register-sw';
import { ThemeProvider } from '../components/ThemeProvider';

export const metadata: Metadata = {
  title: 'TeacherHub PH',
  description: 'All-in-1 DepEd Tools for Filipino Teachers — Revised K-12 Curriculum',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'TeacherHub PH',
  },
  icons: {
    icon: '/icons/icon-192x192.png',
    apple: '/icons/icon-192x192.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#2563EB',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{__html: `
          (function () {
            try {
              var theme = localStorage.getItem('teacherhub-theme') === 'light' ? 'light' : 'dark';
              document.documentElement.classList.add(theme === 'light' ? 'theme-light' : 'theme-dark');
            } catch (_) {
              document.documentElement.classList.add('theme-dark');
            }
          })();
        `}} />
        <RegisterSW />
        <ThemeProvider>
          <SectionProvider>
            {children}
          </SectionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}