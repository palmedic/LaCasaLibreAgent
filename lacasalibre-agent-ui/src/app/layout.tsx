import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'La Casa Libre Agent',
  description: 'LangGraph-based home agent UI for La Casa Libre',
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
