import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Imported HTML pages can be large (template exports easily run 500KB-1MB+);
      // the 1MB default was silently rejecting saves on bigger pages.
      bodySizeLimit: "4mb",
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Blocks clickjacking (embedding the dashboard/login/artist sites in a
          // third-party iframe). Unrelated to this app embedding artist HTML in
          // its own iframes elsewhere — that's this app framing content, not
          // being framed.
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // No "preload" directive — that requires a separate, hard-to-reverse
          // submission to browsers' HSTS preload list, which is a call for the
          // site owner to make deliberately, not something to opt into here.
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
    ];
  },
};

export default nextConfig;
