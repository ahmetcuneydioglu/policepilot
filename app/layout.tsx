import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SigortaOS — Sigorta CRM AI",
  description: "Sigorta acenteleri için akıllı CRM paneli",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" className={`${geistSans.variable} h-full`}>
      <body className="h-full antialiased">{children}</body>
    </html>
  );
}
