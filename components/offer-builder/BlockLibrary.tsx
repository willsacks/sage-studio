"use client";

import { BLOCK_LABELS, type BlockType } from "@/lib/types/builder";
import { useBuilderStore } from "@/lib/store/builder";
import { cn } from "@/lib/utils/cn";
import {
  Image, Type, LayoutGrid, MessageSquare, CreditCard,
  ImagePlay, Shield, Megaphone, Video, Minus, ArrowUpDown, Compass, ClipboardList,
  Music2, Disc3, ListMusic, Send,
} from "lucide-react";

const BLOCK_ICONS: Record<BlockType, React.ReactNode> = {
  hero: <Image size={16} />,
  text: <Type size={16} />,
  feature_grid: <LayoutGrid size={16} />,
  testimonial: <MessageSquare size={16} />,
  pricing_card: <CreditCard size={16} />,
  image_text: <ImagePlay size={16} />,
  guarantee: <Shield size={16} />,
  cta_banner: <Megaphone size={16} />,
  video_embed: <Video size={16} />,
  spacer: <ArrowUpDown size={16} />,
  divider: <Minus size={16} />,
  corner_nav: <Compass size={16} />,
  application_form: <ClipboardList size={16} />,
  music_embed: <Music2 size={16} />,
  album_showcase: <Disc3 size={16} />,
  discography: <ListMusic size={16} />,
  simple_form: <Send size={16} />,
};

const BLOCK_GROUPS: { label: string; blocks: BlockType[] }[] = [
  { label: "Content", blocks: ["hero", "text", "image_text", "video_embed"] },
  { label: "Social Proof", blocks: ["testimonial", "feature_grid"] },
  { label: "Conversion", blocks: ["pricing_card", "cta_banner", "guarantee", "application_form", "simple_form"] },
  { label: "Music", blocks: ["music_embed", "album_showcase", "discography"] },
  { label: "Layout", blocks: ["spacer", "divider"] },
  { label: "Homepage", blocks: ["corner_nav"] },
];

export function BlockLibrary({ selectedBlockId }: { selectedBlockId: string | null }) {
  const addBlock = useBuilderStore((s) => s.addBlock);

  return (
    <div className="w-56 flex-shrink-0 border-r border-[var(--border)] bg-[var(--sidebar)] flex flex-col overflow-y-auto">
      <div className="px-4 py-3 border-b border-[var(--border)]">
        <p className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
          Blocks
        </p>
      </div>
      <div className="flex-1 py-3 space-y-4 px-3">
        {BLOCK_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-2 px-1">
              {group.label}
            </p>
            <div className="space-y-1">
              {group.blocks.map((type) => (
                <button
                  key={type}
                  onClick={() => addBlock(type, selectedBlockId)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm",
                    "text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors text-left",
                    "cursor-pointer"
                  )}
                >
                  <span className="text-[var(--muted-foreground)]">
                    {BLOCK_ICONS[type]}
                  </span>
                  {BLOCK_LABELS[type]}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
