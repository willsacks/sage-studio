"use client";

import { useEffect, useRef } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useBuilderStore } from "@/lib/store/builder";
import { BLOCK_LABELS, type Block } from "@/lib/types/builder";
import { cn } from "@/lib/utils/cn";
import { GripVertical, Trash2, Copy, Plus } from "lucide-react";

function SortableBlock({ block }: { block: Block }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: block.id });

  const selectedBlockId = useBuilderStore((s) => s.selectedBlockId);
  const selectBlock = useBuilderStore((s) => s.selectBlock);
  const removeBlock = useBuilderStore((s) => s.removeBlock);
  const duplicateBlock = useBuilderStore((s) => s.duplicateBlock);
  const addBlock = useBuilderStore((s) => s.addBlock);

  const isSelected = selectedBlockId === block.id;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  // Lazy-load the block renderer to avoid SSR issues
  const [BlockComponent, setBlockComponent] = React.useState<React.ComponentType<{ data: typeof block.data; isEditing?: boolean }> | null>(null);

  useEffect(() => {
    import("./blocks").then((m) => {
      const map: Record<string, React.ComponentType<{ data: typeof block.data; isEditing?: boolean }>> = {
        hero: m.HeroBlock as never,
        text: m.TextBlock as never,
        image: m.ImageBlock as never,
        feature_grid: m.FeatureGridBlock as never,
        testimonial: m.TestimonialBlock as never,
        pricing_card: m.PricingCardBlock as never,
        image_text: m.ImageTextBlock as never,
        guarantee: m.GuaranteeBlock as never,
        cta_banner: m.CTABannerBlock as never,
        video_embed: m.VideoEmbedBlock as never,
        spacer: m.SpacerBlock as never,
        divider: m.DividerBlock as never,
        corner_nav: m.CornerNavBlock as never,
        application_form: m.ApplicationFormBlock as never,
      };
      setBlockComponent(() => map[block.type] ?? null);
    });
  }, [block.type]);

  return (
    <div ref={setNodeRef} style={style} className="group relative">
      {/* Selection border */}
      <div
        onClick={() => selectBlock(isSelected ? null : block.id)}
        className={cn(
          "relative rounded-sm transition-all cursor-pointer",
          isSelected
            ? "ring-2 ring-[var(--primary)] ring-offset-2 ring-offset-[var(--background)]"
            : "hover:ring-1 hover:ring-[var(--border)]"
        )}
      >
        {/* Block controls */}
        <div
          className={cn(
            "absolute -top-9 left-0 flex items-center gap-1 z-20 transition-opacity",
            isSelected || isDragging ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          )}
        >
          <div
            {...attributes}
            {...listeners}
            className="flex items-center gap-1 px-2 py-1 rounded bg-[var(--primary)] text-[var(--primary-foreground)] text-[10px] font-semibold cursor-grab active:cursor-grabbing"
          >
            <GripVertical size={12} />
            {BLOCK_LABELS[block.type]}
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); duplicateBlock(block.id); }}
            className="p-1 rounded bg-[var(--card)] border border-[var(--border)] hover:bg-[var(--accent)] text-[var(--muted-foreground)]"
            title="Duplicate"
          >
            <Copy size={12} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); removeBlock(block.id); }}
            className="p-1 rounded bg-[var(--card)] border border-[var(--border)] hover:bg-red-500 hover:border-red-500 hover:text-white text-[var(--muted-foreground)]"
            title="Delete"
          >
            <Trash2 size={12} />
          </button>
        </div>

        {/* Block content */}
        <div className="overflow-hidden rounded-sm">
          {BlockComponent ? (
            <BlockComponent data={block.data as never} isEditing />
          ) : (
            <div className="h-24 flex items-center justify-center text-[var(--muted-foreground)] text-sm bg-[var(--muted)]">
              Loading...
            </div>
          )}
        </div>
      </div>

      {/* Add block between items */}
      <div className={cn(
        "flex items-center justify-center h-6 opacity-0 group-hover:opacity-100 transition-opacity",
        isSelected && "opacity-100"
      )}>
        <button
          onClick={() => addBlock("text", block.id)}
          className="flex items-center gap-1 text-[10px] text-[var(--muted-foreground)] hover:text-[var(--primary)] transition-colors"
        >
          <Plus size={10} /> Add block
        </button>
      </div>
    </div>
  );
}

// Need React import for useState/useEffect in the component above
import React from "react";
import type { Viewport } from "./Builder";

const VIEWPORT_WIDTHS: Record<Viewport, string> = {
  desktop: "w-full",
  tablet: "w-[768px]",
  mobile: "w-[390px]",
};

export function Canvas({ viewport = "desktop" }: { viewport?: Viewport }) {
  const blocks = useBuilderStore((s) => s.blocks);
  const addBlock = useBuilderStore((s) => s.addBlock);
  const moveBlock = useBuilderStore((s) => s.moveBlock);
  const selectedBlockId = useBuilderStore((s) => s.selectedBlockId);
  const selectBlock = useBuilderStore((s) => s.selectBlock);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const fromIndex = blocks.findIndex((b) => b.id === active.id);
      const toIndex = blocks.findIndex((b) => b.id === over.id);
      moveBlock(fromIndex, toIndex);
    }
  }

  return (
    <div
      className="flex-1 h-full overflow-y-auto bg-[var(--muted)] flex justify-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) selectBlock(null);
      }}
    >
      <div
        className={cn(
          "transition-all duration-300 py-10 min-h-full flex-shrink-0",
          viewport === "desktop" ? "w-full px-6" : cn(VIEWPORT_WIDTHS[viewport], "px-0")
        )}
      >
        {blocks.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center gap-4 py-24 border-2 border-dashed border-[var(--border)] rounded-lg cursor-pointer hover:border-[var(--primary)] transition-colors"
            onClick={() => addBlock("hero")}
          >
            <div className="text-4xl">✦</div>
            <p className="text-[var(--muted-foreground)] text-center">
              <span className="text-[var(--primary)] font-medium">Click to add your first block</span>
              <br />
              <span className="text-sm">or drag blocks from the left panel</span>
            </p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={blocks.map((b) => b.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2 pt-8">
                {blocks.map((block) => (
                  <SortableBlock key={block.id} block={block} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  );
}
