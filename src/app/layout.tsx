import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: {
    default: "TFD Tracker — The First Descendant Inventory Tracker",
    template: "%s | TFD Tracker",
  },
  description:
    "Track every reactor, weapon, descendant, and material in The First Descendant. Sign in with Discord and keep your full inventory synced, private, and shareable with your squad.",
  metadataBase: new URL("https://tfdtracker.gg"),
  openGraph: {
    type: "website",
    url: "https://tfdtracker.gg",
    siteName: "TFD Tracker",
    title: "TFD Tracker — The First Descendant Inventory Tracker",
    description:
      "Track reactors, weapons, descendants & materials. Sign in with Discord — free, private, shareable.",
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
      </head>
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
