"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, Unlink, Plus, Trash2, ListChecks, Landmark, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConnectBankButton } from "./ConnectBankButton";
import { ReconciliationView } from "./ReconciliationView";
import { listBankConnections, mapBankAccountToChartAccount, unlinkBankAccount } from "@/lib/actions/finance-bank";
import { listChartOfAccounts, createChartAccount, setChartAccountActive } from "@/lib/actions/finance-accounts";
import { listFinanceProjects } from "@/lib/actions/finance-projects";
import { listCategorizationRules, createCategorizationRule, deleteCategorizationRule } from "@/lib/actions/finance-rules";
import type { FinanceEntity } from "./FinancesApp";

type BankAccount = {
  id: string;
  bank_connection_id: string;
  name: string;
  mask: string | null;
  chart_account_id: string | null;
  bank_connections: { institution_name: string | null; status: string; last_synced_at: string | null } | { institution_name: string | null; status: string; last_synced_at: string | null }[];
};
type Account = { id: string; name: string; account_subtype: string; account_type: string; is_active?: boolean };
type Project = { id: string; name: string };
type Rule = { id: string; match_type: string; match_value: string; chart_account_id: string; default_project_id: string | null };

const MONEY_SUBTYPES = ["Cash and Bank", "Credit Card"];

export function BankTab({ entity }: { entity: FinanceEntity }) {
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reconcilingAccount, setReconcilingAccount] = useState<BankAccount | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSubtype, setNewSubtype] = useState<"Cash and Bank" | "Credit Card">("Cash and Bank");
  const [creatingAccount, setCreatingAccount] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [bankResult, accountsResult, projectsResult, rulesResult] = await Promise.all([
      listBankConnections(entity.id),
      listChartOfAccounts(entity.id),
      listFinanceProjects(entity.id),
      listCategorizationRules(entity.id),
    ]);
    setBankAccounts((bankResult.accounts ?? []) as BankAccount[]);
    setAccounts((accountsResult.accounts ?? []) as Account[]);
    setProjects((projectsResult.projects ?? []) as Project[]);
    setRules((rulesResult.rules ?? []) as Rule[]);
    setLoading(false);
  }, [entity.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleMap(bankAccountId: string, chartAccountId: string) {
    await mapBankAccountToChartAccount(bankAccountId, entity.id, chartAccountId);
    refresh();
  }

  async function handleUnlink(bankAccountId: string) {
    await unlinkBankAccount(bankAccountId, entity.id);
    refresh();
  }

  async function handleSync(bankConnectionId: string) {
    setSyncingId(bankConnectionId);
    setError(null);
    const response = await fetch("/api/finance/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bankConnectionId, entityId: entity.id }),
    });
    const result = await response.json();
    setSyncingId(null);
    if (result.error) setError(result.error);
    refresh();
  }

  async function handleCreateAccount() {
    if (!newName.trim()) return;
    setCreatingAccount(true);
    const result = await createChartAccount({
      entityId: entity.id,
      name: newName.trim(),
      accountType: newSubtype === "Credit Card" ? "liability" : "asset",
      accountSubtype: newSubtype,
    });
    setCreatingAccount(false);
    if ("error" in result) {
      setError(result.error ?? "Failed to add account");
      return;
    }
    setNewName("");
    setShowAddForm(false);
    refresh();
  }

  async function handleDeactivate(accountId: string) {
    await setChartAccountActive(accountId, entity.id, false);
    refresh();
  }

  const moneyAccounts = accounts.filter((a) => MONEY_SUBTYPES.includes(a.account_subtype) && a.is_active !== false);
  // Every money account shows up here regardless of source — manually
  // added, imported (from QuickBooks/Wave), or Plaid-linked — rather than
  // this tab only ever showing Plaid connections and leaving every other
  // account invisible to a user who never opens the separate Chart of
  // Accounts screen.
  const bankAccountByChartId = new Map(bankAccounts.map((ba) => [ba.chart_account_id, ba]));

  if (loading) return <div className="flex justify-center py-10"><Loader2 size={18} className="animate-spin text-[var(--muted-foreground)]" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <ConnectBankButton entityId={entity.id} onConnected={refresh} />
        <Button size="sm" variant="outline" onClick={() => setShowAddForm((v) => !v)}>
          <Plus size={14} className="mr-1" /> Add account manually
        </Button>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}

      {showAddForm && (
        <div className="rounded-xl border border-[var(--border)] p-4 flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <label className="text-xs font-medium text-[var(--muted-foreground)]">Name</label>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Business Checking" className="h-9 text-sm w-56" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-[var(--muted-foreground)]">Type</label>
            <select value={newSubtype} onChange={(e) => setNewSubtype(e.target.value as "Cash and Bank" | "Credit Card")} className="h-9 px-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm">
              <option value="Cash and Bank">Bank account</option>
              <option value="Credit Card">Credit card</option>
            </select>
          </div>
          <Button size="sm" onClick={handleCreateAccount} disabled={creatingAccount || !newName.trim()}>
            {creatingAccount && <Loader2 size={13} className="animate-spin mr-1" />} Add
          </Button>
        </div>
      )}

      {moneyAccounts.length === 0 ? (
        <p className="text-sm text-[var(--muted-foreground)] py-4">No accounts yet — connect one with Plaid or add one manually.</p>
      ) : (
        <div className="rounded-xl border border-[var(--border)] divide-y divide-[var(--border)]">
          {moneyAccounts.map((account) => {
            const ba = bankAccountByChartId.get(account.id);
            const connection = ba ? (Array.isArray(ba.bank_connections) ? ba.bank_connections[0] : ba.bank_connections) : null;
            const Icon = account.account_subtype === "Credit Card" ? CreditCard : Landmark;
            return (
              <div key={account.id} className="flex items-center justify-between px-4 py-3 gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Icon size={16} className="text-[var(--muted-foreground)] flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {account.name} {ba?.mask && <span className="text-[var(--muted-foreground)]">•••• {ba.mask}</span>}
                    </p>
                    <p className="text-xs text-[var(--muted-foreground)] truncate">
                      {ba ? (
                        <>
                          {connection?.institution_name ?? "Connected via Plaid"}
                          {connection?.status === "error" && <span className="text-red-500"> (needs reconnecting)</span>}
                          {connection?.last_synced_at && ` · Last synced ${new Date(connection.last_synced_at).toLocaleString()}`}
                        </>
                      ) : (
                        <>{account.account_subtype} · not connected to a bank</>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-none">
                  {ba ? (
                    <>
                      <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => handleSync(ba.bank_connection_id)} disabled={syncingId === ba.bank_connection_id}>
                        {syncingId === ba.bank_connection_id ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                      </Button>
                      <button onClick={() => setReconcilingAccount(ba)} className="p-1.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)]" title="Reconcile">
                        <ListChecks size={14} />
                      </button>
                      <button onClick={() => handleUnlink(ba.id)} className="p-1.5 text-[var(--muted-foreground)] hover:text-red-500" title="Unlink from Plaid">
                        <Unlink size={14} />
                      </button>
                    </>
                  ) : (
                    <button onClick={() => handleDeactivate(account.id)} className="p-1.5 text-[var(--muted-foreground)] hover:text-red-500" title="Remove account">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {bankAccounts.some((ba) => !ba.chart_account_id) && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
          <p className="text-xs font-medium text-amber-700 mb-2">Newly connected — map these to an account above before they can sync:</p>
          {bankAccounts.filter((ba) => !ba.chart_account_id).map((ba) => (
            <div key={ba.id} className="flex items-center justify-between gap-2 py-1">
              <span className="text-sm">{ba.name} {ba.mask && <span className="text-[var(--muted-foreground)]">•••• {ba.mask}</span>}</span>
              <select
                value=""
                onChange={(e) => handleMap(ba.id, e.target.value)}
                className="h-8 px-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-xs"
              >
                <option value="" disabled>Which account is this?</option>
                {moneyAccounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}

      <RulesManager entityId={entity.id} accounts={accounts} projects={projects} rules={rules} onChanged={refresh} />

      {reconcilingAccount && (
        <ReconciliationView
          entityId={entity.id}
          bankAccountId={reconcilingAccount.id}
          accountName={reconcilingAccount.name}
          onClose={() => setReconcilingAccount(null)}
        />
      )}
    </div>
  );
}

function RulesManager({
  entityId,
  accounts,
  projects,
  rules,
  onChanged,
}: {
  entityId: string;
  accounts: Account[];
  projects: Project[];
  rules: Rule[];
  onChanged: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [matchValue, setMatchValue] = useState("");
  const [chartAccountId, setChartAccountId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [creating, setCreating] = useState(false);

  const categoryAccounts = accounts.filter((a) => a.account_type === "income" || a.account_type === "expense");

  async function handleCreate() {
    if (!matchValue.trim() || !chartAccountId) return;
    setCreating(true);
    await createCategorizationRule({ entityId, matchType: "contains", matchValue, chartAccountId, defaultProjectId: projectId || undefined });
    setCreating(false);
    setMatchValue("");
    setChartAccountId("");
    setProjectId("");
    setShowForm(false);
    onChanged();
  }

  async function handleDelete(ruleId: string) {
    await deleteCategorizationRule(ruleId, entityId);
    onChanged();
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <p className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">Auto-categorization rules</p>
        <Button size="sm" variant="outline" onClick={() => setShowForm((v) => !v)}>
          <Plus size={13} className="mr-1" /> New rule
        </Button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-[var(--border)] p-3 space-y-2 mb-2">
          <div className="grid grid-cols-3 gap-2">
            <Input value={matchValue} onChange={(e) => setMatchValue(e.target.value)} placeholder="Payee contains..." className="h-9 text-sm" />
            <select value={chartAccountId} onChange={(e) => setChartAccountId(e.target.value)} className="h-9 px-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm">
              <option value="">Category...</option>
              {categoryAccounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="h-9 px-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm">
              <option value="">No project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <Button size="sm" onClick={handleCreate} disabled={creating}>
            {creating && <Loader2 size={13} className="animate-spin mr-1" />} Save rule
          </Button>
        </div>
      )}

      {rules.length === 0 ? (
        <p className="text-xs text-[var(--muted-foreground)]">No rules yet — new transactions land uncategorized until you add one, or categorize manually on the Transactions tab.</p>
      ) : (
        <div className="rounded-xl border border-[var(--border)] divide-y divide-[var(--border)]">
          {rules.map((r) => {
            const account = accounts.find((a) => a.id === r.chart_account_id);
            return (
              <div key={r.id} className="flex items-center justify-between px-3 py-2 text-sm">
                <span>&quot;{r.match_value}&quot; → {account?.name ?? "Unknown"}</span>
                <button onClick={() => handleDelete(r.id)} className="p-1 text-[var(--muted-foreground)] hover:text-red-500">
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
