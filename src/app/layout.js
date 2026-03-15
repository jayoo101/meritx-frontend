import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import Navbar from "@/components/Navbar";
import NetworkGuard from "@/components/NetworkGuard";
import CarbonMeritWrapper from "@/components/CarbonMeritWrapper";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || "https://meritx.io"),
  title: "MeritX | Fair-Launch Protocol on Base",
  description:
    "Launch your token with mathematical fairness. Zero upfront liquidity, automated Uniswap V3 pooling, and strictly enforced anti-stealth mechanisms.",
  openGraph: {
    title: "MeritX | Fair-Launch Protocol on Base",
    description:
      "Launch your token with mathematical fairness. Zero upfront liquidity, automated Uniswap V3 pooling, and strictly enforced anti-stealth mechanisms.",
    type: "website",
    url: "https://meritx.io",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "MeritX Protocol — Fair-Launch on Base",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "MeritX | Fair-Launch Protocol on Base",
    description:
      "Launch your token with mathematical fairness. Zero upfront liquidity, automated Uniswap V3 pooling, and strictly enforced anti-stealth mechanisms.",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-zinc-950 text-zinc-100`}
      >
        <Navbar />
        <NetworkGuard />
        <CarbonMeritWrapper />
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: '#18181b',
              color: '#e4e4e7',
              border: '1px solid #27272a',
            },
            success: {
              iconTheme: { primary: '#2563eb', secondary: '#18181b' },
            },
            error: {
              iconTheme: { primary: '#FF0000', secondary: '#18181b' },
            },
          }}
        />
      </body>
    </html>
  );
}
