import type { Metadata } from 'next';
import './globals.css';
import { SectionProvider } from '../context/SectionContext';

export const metadata: Metadata = {
  title: 'TeacherHub PH',
  description: 'All-in-1 DepEd Tools for Filipino Teachers — Revised K-12 Curriculum',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SectionProvider>
          {children}
        </SectionProvider>
      </body>
    </html>
  );
}