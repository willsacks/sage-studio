import { createBlock } from "@/lib/types/builder";
import type { Block, BlockType, BlockData } from "@/lib/types/builder";

export { createBlock };

export function addBlock(blocks: Block[], type: BlockType, afterBlockId?: string | null, dataOverrides?: Partial<BlockData>): Block[] {
  const block = createBlock(type) as Block;
  if (dataOverrides) Object.assign(block.data, dataOverrides);
  const result = [...blocks];
  if (afterBlockId) {
    const idx = result.findIndex((b) => b.id === afterBlockId);
    result.splice(idx === -1 ? result.length : idx + 1, 0, block);
  } else {
    result.push(block);
  }
  return result;
}

export function updateBlockData(blocks: Block[], blockId: string, data: Partial<BlockData>): Block[] {
  return blocks.map((b) => {
    if (b.id !== blockId) return b;
    const merged = { ...b.data } as BlockData;
    Object.assign(merged, data);
    return { ...b, data: merged } as Block;
  });
}

export function moveBlock(blocks: Block[], blockId: string, targetIndex: number): Block[] {
  const result = [...blocks];
  const fromIndex = result.findIndex((b) => b.id === blockId);
  if (fromIndex === -1) return result;
  const clamped = Math.max(0, Math.min(targetIndex, result.length - 1));
  const [removed] = result.splice(fromIndex, 1);
  result.splice(clamped, 0, removed);
  return result;
}

export function removeBlock(blocks: Block[], blockId: string): Block[] {
  return blocks.filter((b) => b.id !== blockId);
}

export function duplicateBlock(blocks: Block[], blockId: string): Block[] {
  const idx = blocks.findIndex((b) => b.id === blockId);
  if (idx === -1) return blocks;
  const result = [...blocks];
  const copy: Block = {
    ...result[idx],
    id: crypto.randomUUID(),
    data: JSON.parse(JSON.stringify(result[idx].data)),
  };
  result.splice(idx + 1, 0, copy);
  return result;
}
