import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'La Casa Libre Agent',
  description: 'LangGraph-based home agent UI for La Casa Libre',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
