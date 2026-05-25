"use client";

import { renderBlock } from "@/components/offer-builder/blocks";
import type { PageData } from "@/lib/types/builder";

export function OfferPageBlocks({ blocks, basePath, siteSlug }: { blocks: PageData; basePath?: string; siteSlug?: string }) {
  return (
    <>
      {blocks.map((block) => (
        <div key={block.id}>{renderBlock(block, false, basePath, siteSlug)}</div>
      ))}
    </>
  );
}
