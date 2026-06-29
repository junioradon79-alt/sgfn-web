import type { NextConfig } from "next";

/** @type {import('next').NextConfig} */
const nextConfig: NextConfig = {
  output: 'export', // Force la génération de fichiers statiques
  images: {
    unoptimized: true, // Requis pour l'export statique sans serveur Node.js
  },
};

export default nextConfig;

