import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';
import { AppSidebar } from '@/components/app-sidebar';
import { ThemeProvider } from '@/components/theme-provider';
import { StablecoinProvider } from '@/components/stablecoin-provider';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'SSS Admin — Solana Stablecoin Standard',
  description:
    'Admin dashboard for managing stablecoins built with the Solana Stablecoin Standard (SSS).',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <Providers>
            <StablecoinProvider>
              <div className="flex min-h-screen">
                <AppSidebar />
                <main className="ml-64 flex-1">{children}</main>
              </div>
            </StablecoinProvider>
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
