"use client";

import { usePathname } from "next/navigation";

// Routes that manage their own width/padding (e.g. multi-pane layouts) instead
// of the default centered, max-width column.
const FULL_WIDTH_ROUTES = ["/knowledge"];

export function PageContainer({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isFullWidth = FULL_WIDTH_ROUTES.some((route) => pathname.startsWith(route));

  if (isFullWidth) return <>{children}</>;

  return <div className="max-w-4xl mx-auto px-6 py-8">{children}</div>;
}
