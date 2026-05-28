"use client";

import { useEffect } from "react";
import { markSiteSubmissionsRead } from "@/lib/queries/form-submissions";

export function MarkSubmissionsReadOnMount({ siteSlug }: { siteSlug: string }) {
  useEffect(() => {
    markSiteSubmissionsRead(siteSlug).catch(() => {});
  }, [siteSlug]);
  return null;
}
