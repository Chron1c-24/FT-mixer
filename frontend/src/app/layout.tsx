import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FT Mixer & Emphasizer | Team 10",
  description: "Fourier Transform magnitude and phase mixing tool.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-[#09090b] text-[#fafafa] font-sans">
        <header className="bg-[#0f0f11] border-b border-[#222] py-4 px-6 flex items-center justify-between shadow-xl shrink-0">
          <h1 className="text-xl font-bold tracking-widest uppercase text-white">FT Mixer </h1>
          <div className="text-xs text-gray-400 font-mono bg-[#111] px-3 py-1 rounded border border-[#333]">Team 10</div>
        </header>
        <main className="flex-1 flex overflow-hidden">
          {children}
        </main>
      </body>
    </html>
  );
}
