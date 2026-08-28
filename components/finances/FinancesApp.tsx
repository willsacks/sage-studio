"use client";

import { useState } from "react";
import { LayoutGrid, FolderKanban, ArrowLeftRight, BarChart3, BookOpen, Landmark } from "lucide-react";
import { EntitySwitcher } from "./EntitySwitcher";
import { CreateEntityForm } from "./CreateEntityForm";
import { OverviewTab } from "./OverviewTab";
import { ProjectsTab } from "./ProjectsTab";
import { TransactionsTab } from "./TransactionsTab";
import { ReportsTab } from "./ReportsTab";
import { ChartOfAccountsTab } from "./ChartOfAccountsTab";
import { BankTab } from "./BankTab";

export type FinanceEntity = {
  id: string;
  name: string;
  entity_type: "personal" | "business";
  currency: string;
  fiscal_year_start_month: number;
};

type Tab = "overview" | "projects" | "transactions" | "bank" | "reports" | "accounts";

const TABS: { id: Tab; label: string; icon: typeof LayoutGrid }[] = [
  { id: "overview", label: "Overview", icon: LayoutGrid },
  { id: "projects", label: "Projects", icon: FolderKanban },
  { id: "transactions", label: "Transactions", icon: ArrowLeftRight },
  { id: "bank", label: "Bank Accounts", icon: Landmark },
  { id: "reports", label: "Reports", icon: BarChart3 },
  { id: "accounts", label: "Chart of Accounts", icon: BookOpen },
];

export function FinancesApp({ initialEntities }: { initialEntities: FinanceEntity[] }) {
  const [entities, setEntities] = useState(initialEntities);
  const [currentEntityId, setCurrentEntityId] = useState<string | null>(initialEntities[0]?.id ?? null);
  const [tab, setTab] = useState<Tab>("overview");

  function handleEntityCreated(entity: FinanceEntity) {
    setEntities((prev) => [...prev, entity]);
    setCurrentEntityId(entity.id);
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
          onChange={setCurrentEntityId}
          onCreated={handleEntityCreated}
        />
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
      {tab === "bank" && <BankTab entity={currentEntity} />}
      {tab === "reports" && <ReportsTab entity={currentEntity} />}
      {tab === "accounts" && <ChartOfAccountsTab entity={currentEntity} />}
    </div>
  );
}
