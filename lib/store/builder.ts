"use client";

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import {
  type Block,
  type BlockType,
  type BlockData,
  type PageTheme,
  DEFAULT_THEME,
  createBlock,
} from "@/lib/types/builder";

export interface SitePageRef { id: string; title: string; slug: string }

interface BuilderState {
  blocks: Block[];
  selectedBlockId: string | null;
  isDirty: boolean;
  theme: PageTheme;
  siteContext: { siteSlug: string; pages: SitePageRef[] } | null;

  setBlocks: (blocks: Block[]) => void;
  setSiteContext: (ctx: { siteSlug: string; pages: SitePageRef[] } | null) => void;
  setTheme: (theme: PageTheme) => void;
  updateTheme: (partial: Partial<PageTheme>) => void;
  addBlock: (type: BlockType, afterId?: string | null) => void;
  removeBlock: (id: string) => void;
  updateBlockData: (id: string, data: Partial<BlockData>) => void;
  moveBlock: (fromIndex: number, toIndex: number) => void;
  duplicateBlock: (id: string) => void;
  selectBlock: (id: string | null) => void;
  markSaved: () => void;
  reset: (blocks: Block[], theme?: PageTheme) => void;
}

export const useBuilderStore = create<BuilderState>()(
  immer((set) => ({
    blocks: [],
    selectedBlockId: null,
    isDirty: false,
    theme: DEFAULT_THEME,
    siteContext: null,

    setSiteContext: (ctx) =>
      set((state) => {
        state.siteContext = ctx;
      }),

    setBlocks: (blocks) =>
      set((state) => {
        state.blocks = blocks;
        state.isDirty = true;
      }),

    setTheme: (theme) =>
      set((state) => {
        state.theme = theme;
        state.isDirty = true;
      }),

    updateTheme: (partial) =>
      set((state) => {
        Object.assign(state.theme, partial);
        state.isDirty = true;
      }),

    addBlock: (type, afterId) =>
      set((state) => {
        const block = createBlock(type);
        if (afterId) {
          const idx = state.blocks.findIndex((b) => b.id === afterId);
          state.blocks.splice(idx + 1, 0, block);
        } else {
          state.blocks.push(block);
        }
        state.selectedBlockId = block.id;
        state.isDirty = true;
      }),

    removeBlock: (id) =>
      set((state) => {
        const idx = state.blocks.findIndex((b) => b.id === id);
        if (idx !== -1) state.blocks.splice(idx, 1);
        if (state.selectedBlockId === id) state.selectedBlockId = null;
        state.isDirty = true;
      }),

    updateBlockData: (id, data) =>
      set((state) => {
        const block = state.blocks.find((b) => b.id === id);
        if (block) {
          Object.assign(block.data, data);
          state.isDirty = true;
        }
      }),

    moveBlock: (fromIndex, toIndex) =>
      set((state) => {
        const [removed] = state.blocks.splice(fromIndex, 1);
        state.blocks.splice(toIndex, 0, removed);
        state.isDirty = true;
      }),

    duplicateBlock: (id) =>
      set((state) => {
        const idx = state.blocks.findIndex((b) => b.id === id);
        if (idx === -1) return;
        const original = state.blocks[idx];
        const copy: Block = {
          ...original,
          id: crypto.randomUUID(),
          data: JSON.parse(JSON.stringify(original.data)),
        };
        state.blocks.splice(idx + 1, 0, copy);
        state.selectedBlockId = copy.id;
        state.isDirty = true;
      }),

    selectBlock: (id) =>
      set((state) => {
        state.selectedBlockId = id;
      }),

    markSaved: () =>
      set((state) => {
        state.isDirty = false;
      }),

    reset: (blocks, theme) =>
      set((state) => {
        state.blocks = blocks;
        state.theme = theme ?? DEFAULT_THEME;
        state.selectedBlockId = null;
        state.isDirty = false;
      }),
  }))
);
