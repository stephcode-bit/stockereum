import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://stockereum-radar.vercel.app"),
  applicationName: "Stockereum Runner Radar",
  title: {
    default: "Stockereum Runner Radar — Early Token Runners on Ethereum",
    template: "%s · Stockereum Runner Radar",
  },
  description:
    "Surface early-stage token runners on the Stockereum (Ethereum) launchpad before they pump. Real-time rugpull guardrails, copyable contract addresses, and 2x-3x runner detection powered by the Ave.ai v2 API.",
  keywords: [
    "Stockereum",
    "Ethereum",
    "memecoin",
    "launchpad",
    "runner radar",
    "early runner",
    "Ave.ai",
    "rugpull",
    "token security",
    "PWA",
    "Web3",
    "DEX",
    "Uniswap v4",
  ],
  authors: [{ name: "Stockereum Runner Radar" }],
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/favicon-16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: [{ url: "/favicon.ico" }],
  },
  appleWebApp: {
    capable: true,
    title: "Runner Radar",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
  openGraph: {
    type: "website",
    siteName: "Stockereum Runner Radar",
    title: "Stockereum Runner Radar — Early Token Runners on Ethereum",
    description:
      "Find early token runners on the Stockereum (Ethereum) launchpad before they pump. Real-time rugpull guardrails + copyable CAs powered by Ave.ai.",
    images: [{ url: "/icons/icon-512.png", width: 512, height: 512 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Stockereum Runner Radar",
    description:
      "Find early token runners on the Stockereum (Ethereum) launchpad before they pump. Rugpull guardrails + copyable CAs via Ave.ai.",
    images: ["/icons/icon-512.png"],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#000000" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <body
        className={`${inter.variable} ${jetbrains.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
        <SonnerToaster richColors position="top-center" />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
