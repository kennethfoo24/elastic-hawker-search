import type { Metadata } from "next";
import { Anton, Archivo, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const anton = Anton({ weight: "400", subsets: ["latin"], variable: "--font-anton" });
const archivo = Archivo({ subsets: ["latin"], variable: "--font-archivo" });
const plexMono = IBM_Plex_Mono({ weight: ["400", "500"], subsets: ["latin"], variable: "--font-plex-mono" });

export const metadata: Metadata = {
  title: "Hawker Search — one query, four retrieval strategies",
  description:
    "Elastic demo: lexical vs semantic vs naive hybrid vs RRF over a multilingual Singapore hawker food guide.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${anton.variable} ${archivo.variable} ${plexMono.variable}`}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
