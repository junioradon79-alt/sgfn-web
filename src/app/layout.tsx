import type { Metadata, Viewport } from "next";
import "./globals.css";
import { RegisterSW } from "@/components/RegisterSW";

export const metadata: Metadata = {
  title: "SGNF — Système de Gestion Numérique du Foncier",
  description:
    "Plateforme numérique de gestion foncière en Côte d'Ivoire. Centralisez, sécurisez et tracez chaque acte, lot et attributaire.",
  manifest: "/manifest.json",
  applicationName: "SGNF",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SGNF",
  },
  formatDetection: { telephone: false },
  icons: {
    icon: "/logo-embleme.png",
    apple: "/icons/icon-192.png",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Teinte la barre système autour de l'app installée. Deux valeurs, sinon la
  // barre reste claire sur un écran sombre : ce sont les canvas `--background`
  // de `globals.css`, pas le primary — la barre prolonge la page, elle ne la
  // surmonte pas.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F6F8FB" },
    { media: "(prefers-color-scheme: dark)", color: "#0B1524" },
  ],
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
