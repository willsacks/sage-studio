"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, TrendingUp, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listFinanceProjects, createFinanceProject, updateFinanceProject } from "@/lib/actions/finance-projects";
import { fetchProjectProfitability } from "@/lib/actions/finance-reports";
import type { FinanceEntity } from "./FinancesApp";

type Project = {
  id: string;
  name: string;
  project_type: string | null;
  status: "active" | "completed" | "archived";
  client_name: string | null;
  budget: number | null;
};

type Profitability = {
  projectId: string;
  revenue: number;
  expenses: number;
  netProfit: number;
  margin: number | null;
};

function money(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

export function ProjectsTab({ entity }: { entity: FinanceEntity }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [profitability, setProfitability] = useState<Record<string, Profitability>>({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [projectType, setProjectType] = useState("");
  const [clientName, setClientName] = useState("");
  const [budget, setBudget] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [projectsResult, profitabilityResult] = await Promise.all([
      listFinanceProjects(entity.id),
      fetchProjectProfitability(entity.id),
    ]);
    setProjects((projectsResult.projects ?? []) as Project[]);
    const byId: Record<string, Profitability> = {};
    for (const p of profitabilityResult.projects ?? []) byId[p.projectId] = p;
    setProfitability(byId);
    setLoading(false);
  }, [entity.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleCreate() {
    if (!name.trim()) {
      setError("Give the project a name");
      return;
    }
    setCreating(true);
    setError(null);
    const result = await createFinanceProject({
      entityId: entity.id,
      name,
      projectType: projectType || undefined,
      clientName: clientName || undefined,
      budget: budget ? Number(budget) : undefined,
    });
    setCreating(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setName("");
    setProjectType("");
    setClientName("");
    setBudget("");
    setShowForm(false);
    refresh();
  }

  async function toggleStatus(project: Project) {
    const nextStatus = project.status === "active" ? "completed" : "active";
    await updateFinanceProject(project.id, entity.id, { status: nextStatus });
    refresh();
  }

  if (loading) {
    return <div className="flex justify-center py-10"><Loader2 size={18} className="animate-spin text-[var(--muted-foreground)]" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-[var(--muted-foreground)]">
          Which project actually made money — attach transactions to a project on the Transactions tab.
        </p>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          <Plus size={14} className="mr-1" /> New project
        </Button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-[var(--border)] p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--muted-foreground)]">Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Winter Tour 2026" className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--muted-foreground)]">Type</label>
              <Input value={projectType} onChange={(e) => setProjectType(e.target.value)} placeholder="Album, Tour, Residency..." className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--muted-foreground)]">Client (optional)</label>
              <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="For commissioned work" className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--muted-foreground)]">Budget (optional)</label>
              <Input type="number" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="0.00" className="h-9 text-sm" />
            </div>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button size="sm" onClick={handleCreate} disabled={creating}>
            {creating && <Loader2 size={13} className="animate-spin mr-1" />} Create project
          </Button>
        </div>
      )}

      {projects.length === 0 ? (
        <p className="text-sm text-[var(--muted-foreground)] py-8 text-center">No projects yet.</p>
      ) : (
        <div className="rounded-xl border border-[var(--border)] divide-y divide-[var(--border)]">
          {projects.map((p) => {
            const p11y = profitability[p.id];
            const positive = p11y && p11y.netProfit >= 0;
            return (
              <div key={p.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{p.name}</p>
                    {p.project_type && <span className="text-xs text-[var(--muted-foreground)]">{p.project_type}</span>}
                    <button
                      onClick={() => toggleStatus(p)}
                      className={`text-xs px-1.5 py-0.5 rounded-full ${p.status === "active" ? "bg-green-500/10 text-green-600" : "bg-[var(--muted)] text-[var(--muted-foreground)]"}`}
                    >
                      {p.status}
                    </button>
                  </div>
                  {p.client_name && <p className="text-xs text-[var(--muted-foreground)] mt-0.5">Client: {p.client_name}</p>}
                </div>
                {p11y && (p11y.revenue > 0 || p11y.expenses > 0) ? (
                  <div className="text-right">
                    <div className={`flex items-center gap-1 text-sm font-medium justify-end ${positive ? "text-green-600" : "text-red-500"}`}>
                      {positive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                      {money(p11y.netProfit)}
                    </div>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      {money(p11y.revenue)} in – {money(p11y.expenses)} out
                      {p11y.margin !== null && ` · ${p11y.margin}% margin`}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-[var(--muted-foreground)]">No transactions yet</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
