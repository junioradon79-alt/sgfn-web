import type { Metadata, Viewport } from "next";
import "./globals.css";
import { RegisterSW } from "@/components/RegisterSW";

export const metadata: Metadata = {
  title: "SGFN — Système de Gestion du Foncier Numérique",
  description:
    "Plateforme numérique de gestion foncière en Côte d'Ivoire. Centralisez, sécurisez et tracez chaque acte, lot et attributaire.",
  manifest: "/manifest.json",
  applicationName: "SGFN",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SGFN",
  },
  formatDetection: { telephone: false },
  icons: {
    icon: "/logo-officiel.png",
    apple: "/icons/icon-192.png",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0D3B66",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="h-full antialiased scroll-smooth">
      <body className="min-h-full flex flex-col">
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
