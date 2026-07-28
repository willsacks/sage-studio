"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent, type DragOverEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical, ChevronDown, ChevronRight, ExternalLink, Eye, EyeOff,
  Home, Navigation, PanelTop, Pencil, Outdent,
} from "lucide-react";
import { togglePagePublished, updatePageVisibility, reorderSitePages } from "@/lib/actions/sites";
import { SetHomePageButton } from "@/components/site/SetHomePageButton";
import { DeletePageDialog } from "@/components/site/DeletePageDialog";
import type { SitePage } from "@/lib/queries/sites";

type Row = { page: SitePage; depth: 0 | 1; hasChildren: boolean; childCount: number };

function buildTree(pages: SitePage[]) {
  const byId = new Map(pages.map((p) => [p.id, p]));
  const topLevel: SitePage[] = [];
  const childrenByParent = new Map<string, SitePage[]>();
  for (const p of pages) {
    const parent = p.parent_page_id ? byId.get(p.parent_page_id) : null;
    // Only one level of nesting: a page is a "child" only if its parent is
    // itself top-level. Anything else (missing parent, parent is a child) is
    // treated as top-level so pages never silently disappear.
    if (parent && !parent.parent_page_id) {
      if (!childrenByParent.has(parent.id)) childrenByParent.set(parent.id, []);
      childrenByParent.get(parent.id)!.push(p);
    } else {
      topLevel.push(p);
    }
  }
  topLevel.sort((a, b) => a.sort_order - b.sort_order);
  for (const arr of childrenByParent.values()) arr.sort((a, b) => a.sort_order - b.sort_order);
  return { topLevel, childrenByParent };
}

function buildRows(pages: SitePage[], collapsed: Set<string>): Row[] {
  const { topLevel, childrenByParent } = buildTree(pages);
  const rows: Row[] = [];
  for (const p of topLevel) {
    const children = childrenByParent.get(p.id) ?? [];
    rows.push({ page: p, depth: 0, hasChildren: children.length > 0, childCount: children.length });
    if (children.length > 0 && !collapsed.has(p.id)) {
      for (const c of children) rows.push({ page: c, depth: 1, hasChildren: false, childCount: 0 });
    }
  }
  return rows;
}

export function PagesManager({
  siteId,
  siteUrl,
  pages: initialPages,
  homePageId,
  canEdit,
}: {
  siteId: string;
  siteUrl: string;
  pages: SitePage[];
  homePageId: string | undefined;
  canEdit: boolean;
}) {
  const [pages, setPages] = useState(initialPages);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [groupTargetId, setGroupTargetId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // dnd-kit's active.rect.current.translated also picks up the sortable
  // strategy's own reordering-preview offset, not just the pointer's raw
  // delta — makes it useless for "where in the target row is the pointer"
  // math. Track the real pointer position ourselves instead.
  const pointerYRef = useRef<number | null>(null);

  useEffect(() => setPages(initialPages), [initialPages]);

  useEffect(() => {
    function onPointerMove(e: PointerEvent) { pointerYRef.current = e.clientY; }
    window.addEventListener("pointermove", onPointerMove);
    return () => window.removeEventListener("pointermove", onPointerMove);
  }, []);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const homePage = pages.find((p) => p.id === homePageId);
  const managedPages = pages.filter((p) => p.id !== homePageId);
  const rows = buildRows(managedPages, collapsed);

  function toggleCollapse(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // Computed fresh (not cached from onDragOver) every time it's needed —
  // onDragOver can fire once early in a fast drag and then go quiet while
  // the pointer keeps moving, so trusting a value it cached would decide
  // group-vs-reorder from a stale position instead of where the pointer
  // actually was at drop time.
  function computeDropIntent(overId: string, overRect: { top: number; height: number } | null) {
    const overPage = managedPages.find((p) => p.id === overId);
    const activePage = activeDragId ? managedPages.find((p) => p.id === activeDragId) : undefined;
    if (!overPage || !activePage || !overRect) return { canGroup: false, isMidBand: false, after: false };
    const activeHasChildren = managedPages.some((p) => p.parent_page_id === activePage.id);
    const overIsChild = !!overPage.parent_page_id;
    const canGroup = !activeHasChildren && !overIsChild;
    const pointerY = pointerYRef.current;
    if (pointerY == null) return { canGroup, isMidBand: false, after: false };
    const relative = (pointerY - overRect.top) / overRect.height;
    return { canGroup, isMidBand: relative > 0.25 && relative < 0.75, after: relative >= 0.5 };
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveDragId(event.active.id as string);
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      setGroupTargetId(null);
      return;
    }
    const { canGroup, isMidBand } = computeDropIntent(over.id as string, over.rect);
    setGroupTargetId(canGroup && isMidBand ? (over.id as string) : null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveDragId(null);
    setGroupTargetId(null);
    if (!over || active.id === over.id) return;

    const activeId = active.id as string;
    const overId = over.id as string;
    const activePage = managedPages.find((p) => p.id === activeId);
    const overPage = managedPages.find((p) => p.id === overId);
    if (!activePage || !overPage) return;

    const { canGroup, isMidBand, after } = computeDropIntent(overId, over.rect);
    const isGroupDrop = canGroup && isMidBand;

    let next: SitePage[];

    if (isGroupDrop) {
      const siblingChildren = managedPages.filter((p) => p.parent_page_id === overPage.id && p.id !== activeId);
      const newSortOrder = siblingChildren.length;
      next = pages.map((p) => (p.id === activeId ? { ...p, parent_page_id: overPage.id, sort_order: newSortOrder } : p));
      setCollapsed((prev) => {
        if (!prev.has(overPage.id)) return prev;
        const nextSet = new Set(prev);
        nextSet.delete(overPage.id);
        return nextSet;
      });
    } else {
      const destParentId = overPage.parent_page_id ?? null;
      const scopeSiblings = managedPages
        .filter((p) => (p.parent_page_id ?? null) === destParentId && p.id !== activeId)
        .sort((a, b) => a.sort_order - b.sort_order);
      const overIndexInScope = scopeSiblings.findIndex((p) => p.id === overId);
      const insertIndex = overIndexInScope + (after ? 1 : 0);
      scopeSiblings.splice(insertIndex, 0, { ...activePage, parent_page_id: destParentId });
      const scopeOrder = new Map(scopeSiblings.map((p, i) => [p.id, i]));
      next = pages.map((p) => {
        if (p.id === activeId) return { ...p, parent_page_id: destParentId, sort_order: scopeOrder.get(activeId)! };
        if (scopeOrder.has(p.id)) return { ...p, sort_order: scopeOrder.get(p.id)! };
        return p;
      });
    }

    setPages(next);
    const changed = next
      .filter((p) => {
        const orig = pages.find((op) => op.id === p.id)!;
        return orig.sort_order !== p.sort_order || (orig.parent_page_id ?? null) !== (p.parent_page_id ?? null);
      })
      .map((p) => ({ id: p.id, sort_order: p.sort_order, parent_page_id: p.parent_page_id ?? null }));
    if (changed.length > 0) {
      startTransition(() => { reorderSitePages(siteId, changed); });
    }
  }

  function handleUngroup(page: SitePage) {
    const topLevelCount = managedPages.filter((p) => !p.parent_page_id).length;
    const next = pages.map((p) => (p.id === page.id ? { ...p, parent_page_id: null, sort_order: topLevelCount } : p));
    setPages(next);
    startTransition(() => {
      reorderSitePages(siteId, [{ id: page.id, sort_order: topLevelCount, parent_page_id: null }]);
    });
  }

  return (
    <div className="space-y-2">
      {homePage && (
        <PageRow
          page={homePage}
          siteId={siteId}
          siteUrl={siteUrl}
          canEdit={canEdit}
          isHome
          depth={0}
        />
      )}

      {rows.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={rows.map((r) => r.page.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {rows.map((row) => (
                <SortablePageRow
                  key={row.page.id}
                  row={row}
                  siteId={siteId}
                  siteUrl={siteUrl}
                  canEdit={canEdit}
                  isDragging={activeDragId === row.page.id}
                  isGroupTarget={groupTargetId === row.page.id}
                  isCollapsed={collapsed.has(row.page.id)}
                  onToggleCollapse={() => toggleCollapse(row.page.id)}
                  onUngroup={() => handleUngroup(row.page)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

function SortablePageRow({
  row, siteId, siteUrl, canEdit, isDragging, isGroupTarget, isCollapsed, onToggleCollapse, onUngroup,
}: {
  row: Row;
  siteId: string;
  siteUrl: string;
  canEdit: boolean;
  isDragging: boolean;
  isGroupTarget: boolean;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onUngroup: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: row.page.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };

  return (
    <div ref={setNodeRef} style={style}>
      <PageRow
        page={row.page}
        siteId={siteId}
        siteUrl={siteUrl}
        canEdit={canEdit}
        depth={row.depth}
        hasChildren={row.hasChildren}
        childCount={row.childCount}
        isCollapsed={isCollapsed}
        isGroupTarget={isGroupTarget}
        onToggleCollapse={onToggleCollapse}
        onUngroup={row.depth === 1 ? onUngroup : undefined}
        dragHandleProps={canEdit ? { ...attributes, ...listeners } : undefined}
      />
    </div>
  );
}

function PageRow({
  page, siteId, siteUrl, canEdit, isHome, depth, hasChildren, childCount,
  isCollapsed, isGroupTarget, onToggleCollapse, onUngroup, dragHandleProps,
}: {
  page: SitePage;
  siteId: string;
  siteUrl: string;
  canEdit: boolean;
  isHome?: boolean;
  depth: 0 | 1;
  hasChildren?: boolean;
  childCount?: number;
  isCollapsed?: boolean;
  isGroupTarget?: boolean;
  onToggleCollapse?: () => void;
  onUngroup?: () => void;
  dragHandleProps?: Record<string, unknown>;
}) {
  const [, startTransition] = useTransition();

  return (
    <div
      className={`flex items-center gap-2 p-4 rounded-xl border transition-colors ${
        isGroupTarget
          ? "border-[var(--primary)] bg-[var(--primary)]/5 ring-1 ring-[var(--primary)]"
          : "border-[var(--border)] bg-[var(--card)] hover:border-[var(--primary)]/30"
      } ${depth === 1 ? "ml-7" : ""}`}
    >
      {dragHandleProps ? (
        <button
          {...dragHandleProps}
          className="flex items-center justify-center w-6 h-6 text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-grab active:cursor-grabbing touch-none flex-shrink-0"
        >
          <GripVertical size={14} />
        </button>
      ) : (
        <span className="w-6 h-6 flex-shrink-0" />
      )}

      {hasChildren ? (
        <button
          onClick={onToggleCollapse}
          className="flex items-center justify-center w-5 h-5 text-[var(--muted-foreground)] hover:text-[var(--foreground)] flex-shrink-0"
        >
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        </button>
      ) : depth === 0 ? (
        <span className="w-5 h-5 flex-shrink-0" />
      ) : null}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-[var(--muted-foreground)] border border-[var(--border)] px-1.5 py-0.5 rounded font-mono">
            /{page.slug}
          </span>
          <p className="font-medium text-[var(--foreground)] truncate">{page.title}</p>
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
            page.status === "published" ? "bg-green-100 text-green-700" : "bg-[var(--muted)] text-[var(--muted-foreground)]"
          }`}>
            {page.status}
          </span>
          {isHome && (
            <span className="flex items-center gap-1 text-[10px] text-[var(--primary)] border border-[var(--primary)]/40 px-1.5 py-0.5 rounded-full">
              <Home size={9} /> Home
            </span>
          )}
          {hasChildren && childCount ? (
            <span className="text-[10px] text-[var(--muted-foreground)]">{childCount} grouped</span>
          ) : null}
        </div>
        <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
          Updated {format(new Date(page.updated_at), "MMM d")}
        </p>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        {page.status === "published" && (
          <Link
            href={`${siteUrl}/${page.slug}`}
            target="_blank"
            className="flex items-center justify-center w-8 h-8 rounded hover:bg-[var(--accent)] text-[var(--muted-foreground)] transition-colors"
          >
            <ExternalLink size={13} />
          </Link>
        )}
        {canEdit && (
          <button
            onClick={() => startTransition(() => { togglePagePublished(page.id, siteId, page.status !== "published"); })}
            className={
              page.status === "published"
                ? "flex items-center gap-1 px-2 py-1 rounded text-xs text-[var(--muted-foreground)] hover:bg-[var(--accent)] transition-colors"
                : "flex items-center gap-1 px-2 py-1 rounded border border-[var(--border)] text-xs hover:bg-[var(--accent)] transition-colors"
            }
          >
            {page.status === "published" ? <><EyeOff size={12} /> Unpublish</> : <><Eye size={12} /> Publish</>}
          </button>
        )}
        {canEdit && !isHome && (
          <SetHomePageButton siteId={siteId} pageId={page.id} />
        )}
        {canEdit && onUngroup && (
          <button
            onClick={onUngroup}
            title="Remove from group"
            className="flex items-center justify-center w-8 h-8 rounded hover:bg-[var(--accent)] text-[var(--muted-foreground)] transition-colors"
          >
            <Outdent size={13} />
          </button>
        )}
        {canEdit && (
          <button
            onClick={() => startTransition(() => { updatePageVisibility(page.id, siteId, { show_in_nav: page.show_in_nav === false }); })}
            title={page.show_in_nav === false ? "Hidden from nav — click to show" : "Shown in nav — click to hide"}
            className={`flex items-center justify-center w-8 h-8 rounded hover:bg-[var(--accent)] transition-colors ${page.show_in_nav === false ? "text-[var(--muted-foreground)] opacity-40" : "text-[var(--foreground)]"}`}
          >
            <Navigation size={13} />
          </button>
        )}
        {canEdit && (
          <button
            onClick={() => startTransition(() => { updatePageVisibility(page.id, siteId, { hide_header: !page.hide_header }); })}
            title={page.hide_header ? "Header hidden — click to show" : "Header visible — click to hide"}
            className={`flex items-center justify-center w-8 h-8 rounded hover:bg-[var(--accent)] transition-colors ${page.hide_header ? "text-[var(--muted-foreground)] opacity-40" : "text-[var(--foreground)]"}`}
          >
            <PanelTop size={13} />
          </button>
        )}
        <Link
          href={`/my-site/${siteId}/pages/${page.id}/edit`}
          className="inline-flex items-center gap-1 px-2 py-1 rounded border border-[var(--border)] text-xs hover:bg-[var(--accent)] transition-colors"
        >
          {canEdit ? <><Pencil size={13} /> Edit</> : "View"}
        </Link>
        {canEdit && <DeletePageDialog pageId={page.id} siteId={siteId} pageTitle={page.title} />}
      </div>
    </div>
  );
}
