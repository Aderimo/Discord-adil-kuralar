import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/contexts/AuthContext';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Yetkili Kılavuzu - SANIYE MODLARI',
  description: 'SANIYE MODLARI Discord sunucusu için Yetkili Kılavuzu ve Ceza Danışman Sistemi',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): React.ReactElement {
  return (
    <html lang="tr" className="dark">
      <body className={`${inter.className} bg-discord-darker text-discord-text antialiased`}>
        <AuthProvider>
          {children}
        </AuthProvider>
        <Toaster />
      </body>
    </html>
  );
}
