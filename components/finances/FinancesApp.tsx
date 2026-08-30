"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LayoutGrid, FolderKanban, ArrowLeftRight, BarChart3, BookOpen, Landmark, FileText, Users, Settings } from "lucide-react";
import { EntitySwitcher } from "./EntitySwitcher";
import { CreateEntityForm } from "./CreateEntityForm";
import { EntitySettingsDialog } from "./EntitySettingsDialog";
import { OverviewTab } from "./OverviewTab";
import { ProjectsTab } from "./ProjectsTab";
import { TransactionsTab } from "./TransactionsTab";
import { ReportsTab } from "./ReportsTab";
import { ChartOfAccountsTab } from "./ChartOfAccountsTab";
import { BankTab } from "./BankTab";
import { InvoicesTab } from "./InvoicesTab";
import { CollaboratorsDialog } from "./CollaboratorsDialog";

export type FinanceEntity = {
  id: string;
  name: string;
  entity_type: "personal" | "business";
  currency: string;
  fiscal_year_start_month: number;
  is_owner?: boolean;
};

type Tab = "overview" | "projects" | "transactions" | "invoices" | "bank" | "reports" | "accounts";

const TABS: { id: Tab; label: string; icon: typeof LayoutGrid }[] = [
  { id: "overview", label: "Overview", icon: LayoutGrid },
  { id: "projects", label: "Projects", icon: FolderKanban },
  { id: "transactions", label: "Transactions", icon: ArrowLeftRight },
  { id: "invoices", label: "Invoices", icon: FileText },
  { id: "bank", label: "Bank Accounts", icon: Landmark },
  { id: "reports", label: "Reports", icon: BarChart3 },
  { id: "accounts", label: "Chart of Accounts", icon: BookOpen },
];

export function FinancesApp({ initialEntities, initialEntityId }: { initialEntities: FinanceEntity[]; initialEntityId?: string }) {
  const router = useRouter();
  const [entities, setEntities] = useState(initialEntities);
  const [currentEntityId, setCurrentEntityId] = useState<string | null>(
    (initialEntityId && initialEntities.some((e) => e.id === initialEntityId) ? initialEntityId : initialEntities[0]?.id) ?? null
  );
  const [tab, setTab] = useState<Tab>("overview");
  const [sharing, setSharing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Keeps ?entity= in the URL in sync with whichever entity is actually
  // selected — the page's server component only knows which entity to
  // pass down via this query param (falling back to the first entity in
  // the list otherwise). Without this, switching entities was purely
  // client-side state: if anything ever caused this component to remount
  // from fresh server props (e.g. Next re-running the server component
  // after a Server Action's revalidatePath — observed after saving two
  // categorizations back to back), the URL still had no entity, so the
  // remount silently fell back to entities[0] — landing the user in a
  // completely different set of books with no warning.
  function selectEntity(id: string | null) {
    setCurrentEntityId(id);
    if (id) router.replace(`/finances?entity=${id}`, { scroll: false });
  }

  useEffect(() => {
    if (currentEntityId && !initialEntityId) {
      router.replace(`/finances?entity=${currentEntityId}`, { scroll: false });
    }
    // Only needs to run once, to backfill the URL on first load — not on
    // every currentEntityId change (selectEntity already handles that).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleEntityCreated(entity: FinanceEntity) {
    setEntities((prev) => [...prev, entity]);
    selectEntity(entity.id);
  }

  function handleEntityDeleted(entityId: string) {
    setEntities((prev) => {
      const next = prev.filter((e) => e.id !== entityId);
      selectEntity(next[0]?.id ?? null);
      return next;
    });
    setSettingsOpen(false);
  }

  if (entities.length === 0) {
    return <CreateEntityForm onCreated={handleEntityCreated} />;
  }

  const currentEntity = entities.find((e) => e.id === currentEntityId) ?? entities[0];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <EntitySwitcher
          entities={entities}
          currentEntityId={currentEntity.id}
          onChange={selectEntity}
          onCreated={handleEntityCreated}
        />
        <div className="flex items-center gap-1">
          <button
            onClick={() => setSharing(true)}
            className="flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] px-2 py-1.5"
          >
            <Users size={14} /> Share access
          </button>
          {currentEntity.is_owner && (
            <button
              onClick={() => setSettingsOpen(true)}
              className="flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] px-2 py-1.5"
            >
              <Settings size={14} /> Settings
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-1 border-b border-[var(--border)] overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
              tab === t.id
                ? "border-[var(--primary)] text-[var(--foreground)]"
                : "border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            }`}
          >
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && <OverviewTab entity={currentEntity} />}
      {tab === "projects" && <ProjectsTab entity={currentEntity} />}
      {tab === "transactions" && <TransactionsTab entity={currentEntity} />}
      {tab === "invoices" && <InvoicesTab entity={currentEntity} />}
      {tab === "bank" && <BankTab entity={currentEntity} />}
      {tab === "reports" && <ReportsTab entity={currentEntity} />}
      {tab === "accounts" && <ChartOfAccountsTab entity={currentEntity} />}

      {sharing && (
        <CollaboratorsDialog entityId={currentEntity.id} entityName={currentEntity.name} onClose={() => setSharing(false)} />
      )}

      {settingsOpen && (
        <EntitySettingsDialog
          entity={currentEntity}
          onClose={() => setSettingsOpen(false)}
          onRenamed={(name) => {
            setEntities((prev) => prev.map((e) => (e.id === currentEntity.id ? { ...e, name } : e)));
            setSettingsOpen(false);
          }}
          onDeleted={() => handleEntityDeleted(currentEntity.id)}
        />
      )}
    </div>
  );
}
