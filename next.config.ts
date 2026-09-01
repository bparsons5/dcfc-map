import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // Allow loading the dev server from a phone on the LAN / a dev tunnel.
  allowedDevOrigins: [
    "192.168.2.203",
    "*.trycloudflare.com",
    "*.ngrok-free.app",
  ],
};

export default nextConfig;
