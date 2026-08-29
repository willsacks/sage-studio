"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, TrendingUp, TrendingDown, Pencil, Trash2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listFinanceProjects, createFinanceProject, updateFinanceProject, deleteFinanceProject } from "@/lib/actions/finance-projects";
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

function p11yBlock(p11y: Profitability | undefined) {
  if (!p11y || (p11y.revenue === 0 && p11y.expenses === 0)) {
    return <p className="text-xs text-[var(--muted-foreground)] whitespace-nowrap">No transactions yet</p>;
  }
  const positive = p11y.netProfit >= 0;
  return (
    <div className="text-right">
      <div className={`flex items-center gap-1 text-sm font-medium justify-end ${positive ? "text-green-600" : "text-red-500"}`}>
        {positive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
        {money(p11y.netProfit)}
      </div>
      <p className="text-xs text-[var(--muted-foreground)] whitespace-nowrap">
        {money(p11y.revenue)} in – {money(p11y.expenses)} out
        {p11y.margin !== null && ` · ${p11y.margin}% margin`}
      </p>
    </div>
  );
}

function EditProjectRow({
  project,
  entityId,
  onCancel,
  onSaved,
}: {
  project: Project;
  entityId: string;
  onCancel: () => void;
  onSaved: (updated: Partial<Project>) => void;
}) {
  const [name, setName] = useState(project.name);
  const [projectType, setProjectType] = useState(project.project_type ?? "");
  const [clientName, setClientName] = useState(project.client_name ?? "");
  const [budget, setBudget] = useState(project.budget != null ? String(project.budget) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!name.trim()) {
      setError("Give the project a name");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await updateFinanceProject(project.id, entityId, {
      name,
      projectType: projectType.trim() || null,
      clientName: clientName.trim() || null,
      budget: budget ? Number(budget) : null,
    });
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onSaved({
      name: name.trim(),
      project_type: projectType.trim() || null,
      client_name: clientName.trim() || null,
      budget: budget ? Number(budget) : null,
    });
  }

  return (
    <div className="px-4 py-3 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--muted-foreground)]">Name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} className="h-9 text-sm" />
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
      <div className="flex gap-2">
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 size={13} className="animate-spin mr-1" /> : <Check size={13} className="mr-1" />} Save
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel} disabled={saving}>
          <X size={13} className="mr-1" /> Cancel
        </Button>
      </div>
    </div>
  );
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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

  async function handleDelete(projectId: string) {
    if (!window.confirm("Delete this project? Transactions attached to it will be unassigned, not deleted.")) return;
    setDeletingId(projectId);
    setDeleteError(null);
    const result = await deleteFinanceProject(projectId, entity.id);
    setDeletingId(null);
    if (result.error) {
      setDeleteError(result.error);
      return;
    }
    setProjects((prev) => prev.filter((p) => p.id !== projectId));
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

      {deleteError && <p className="text-sm text-red-500">{deleteError}</p>}

      {projects.length === 0 ? (
        <p className="text-sm text-[var(--muted-foreground)] py-8 text-center">No projects yet.</p>
      ) : (
        <div className="rounded-xl border border-[var(--border)] divide-y divide-[var(--border)]">
          {projects.map((p) =>
            editingId === p.id ? (
              <EditProjectRow
                key={p.id}
                project={p}
                entityId={entity.id}
                onCancel={() => setEditingId(null)}
                onSaved={(updated) => {
                  setProjects((prev) => prev.map((proj) => (proj.id === p.id ? { ...proj, ...updated } : proj)));
                  setEditingId(null);
                }}
              />
            ) : (
              <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{p.name}</p>
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
                <div className="flex items-center gap-3 flex-none">
                  {p11yBlock(profitability[p.id])}
                  <button onClick={() => setEditingId(p.id)} className="p-1.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)]" title="Edit project">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => handleDelete(p.id)} disabled={deletingId === p.id} className="p-1.5 text-[var(--muted-foreground)] hover:text-red-500" title="Delete project">
                    {deletingId === p.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
