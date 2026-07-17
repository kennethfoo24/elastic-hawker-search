import type { Metadata } from "next";
import { Poppins, Inter, IBM_Plex_Mono, Baloo_2 } from "next/font/google";
import "./globals.css";

const poppins = Poppins({ weight: ["500", "600", "700"], subsets: ["latin"], variable: "--font-poppins" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const plexMono = IBM_Plex_Mono({ weight: ["400", "500"], subsets: ["latin"], variable: "--font-plex-mono" });
const baloo = Baloo_2({ weight: ["600", "700", "800"], subsets: ["latin"], variable: "--font-baloo" });

export const metadata: Metadata = {
  title: "Hawker Search — from Keyword to Hybrid",
  description:
    "Elastic demo: Keyword -> Semantic (multilingual-e5) -> Hybrid (RRF), over a multilingual Singapore hawker food guide.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${poppins.variable} ${inter.variable} ${plexMono.variable} ${baloo.variable}`}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
