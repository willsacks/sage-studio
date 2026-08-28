"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ExportCpaPackageButton({ entityId }: { entityId: string }) {
  const year = new Date().getFullYear();
  return (
    <a href={`/api/finance/export/cpa-package?entityId=${entityId}&year=${year}`}>
      <Button size="sm" variant="outline">
        <Download size={13} className="mr-1" /> Export CPA package
      </Button>
    </a>
  );
}
