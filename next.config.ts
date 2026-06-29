import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Imported HTML pages can be large (template exports easily run 500KB-1MB+);
      // the 1MB default was silently rejecting saves on bigger pages.
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
