import type { Metadata } from "next";
import Header from "@/components/Header";
import { isAdmin } from "@/lib/admin";
import "./globals.css";

export const metadata: Metadata = {
  title: "Matkrig - Jämför veckans erbjudanden",
  description:
    "Jämför veckans erbjudanden från ICA och Coop i Kärrtorp och få receptförslag baserade på rabatterade varor.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const admin = await isAdmin();

  return (
    <html lang="sv" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans bg-gray-50">
        <Header isAdmin={admin} />
        <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
