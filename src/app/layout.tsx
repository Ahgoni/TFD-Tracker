import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f0f4ff" },
    { media: "(prefers-color-scheme: dark)", color: "#080c14" },
  ],
};

export const metadata: Metadata = {
  title: {
    default: "TFD Tracker — The First Descendant Inventory Tracker",
    template: "%s | TFD Tracker",
  },
  description:
    "Track every reactor, weapon, and descendant in The First Descendant. Sign in with Discord and keep your full inventory synced, private, and shareable with your squad.",
  metadataBase: new URL("https://tfdtracker.gg"),
  openGraph: {
    type: "website",
    url: "https://tfdtracker.gg",
    siteName: "TFD Tracker",
    title: "TFD Tracker — The First Descendant Inventory Tracker",
    description:
      "Track reactors, weapons, and descendants. Sign in with Discord — free, private, shareable.",
  },
  twitter: {
    card: "summary",
    title: "TFD Tracker",
    description: "Track your full TFD inventory. Sign in with Discord — free.",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <head>
        {/* Prevent flash of wrong theme on page load */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem('theme')||'dark';document.documentElement.setAttribute('data-theme',t);})();`,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var k='tfd-locale';var v=null;try{var m=document.cookie.match(new RegExp('(?:^|; )'+k+'=([^;]*)'));if(m)v=decodeURIComponent(m[1]);if(!v)v=localStorage.getItem(k);}catch(e){}var L={'en':'en','ko':'ko','ja':'ja','de':'de','fr':'fr','zh-CN':'zh-CN','es':'es'};document.documentElement.lang=L[v]||'en';})();`,
          }}
        />
      </head>
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
