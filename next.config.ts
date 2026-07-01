import type { NextConfig } from "next";

/** @type {import('next').NextConfig} */
const nextConfig: NextConfig = {
  ...(process.env.NODE_ENV === "production" ? { output: "export" as const } : {}),
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;

