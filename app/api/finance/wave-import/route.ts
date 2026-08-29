import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseWaveChartOfAccountsCsv, parseWaveCustomersCsv } from "@/lib/finance/wave-import";
import { commitCreateEntity, commitAccounts, commitCustomers } from "@/lib/finance/import-commit";

// Route Handler rather than a Server Action — CSVs of a few thousand rows
// can trip the Flight-protocol size limit on Server Action arguments, same
// reasoning as the bank-transaction CSV import route.
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const formData = await request.formData();
  const entityName = formData.get("entityName");
  const entityType = formData.get("entityType");
  const accountsFile = formData.get("accountsFile");
  const customersFile = formData.get("customersFile");

  if (typeof entityName !== "string" || !entityName.trim() || (entityType !== "personal" && entityType !== "business")) {
    return NextResponse.json({ error: "entityName and entityType are required" }, { status: 400 });
  }

  // Re-parse server-side even though the wizard already previewed these
  // files client-side — never trust a client-side parse for the actual
  // write, same defensive posture as the bank-transaction import route's
  // server-side account-subtype re-check.
  const accountErrors: string[] = [];

  const { data: job, error: jobError } = await supabase
    .from("import_jobs")
    .insert({ owner_id: user.id, source: "wave", status: "running", phase: "creating_entity" })
    .select("id")
    .single();
  if (jobError || !job) return NextResponse.json({ error: jobError?.message ?? "Failed to create import job" }, { status: 500 });

  try {
    const created = await commitCreateEntity(supabase, { ownerId: user.id, name: `${entityName.trim()} (from Wave)`, entityType });
    if ("error" in created) throw new Error(created.error);

    await supabase.from("import_jobs").update({ entity_id: created.entityId, phase: "accounts" }).eq("id", job.id);

    let accountsResult = { rows: [] as ReturnType<typeof parseWaveChartOfAccountsCsv>["rows"], errors: [] as string[] };
    if (accountsFile instanceof File) {
      accountsResult = parseWaveChartOfAccountsCsv(await accountsFile.text());
      accountErrors.push(...accountsResult.errors);
      const result = await commitAccounts(supabase, created.entityId, accountsResult.rows);
      if ("error" in result) throw new Error(result.error);
    }

    await supabase.from("import_jobs").update({ phase: "customers" }).eq("id", job.id);

    const customerErrors: string[] = [];
    if (customersFile instanceof File) {
      const customersResult = parseWaveCustomersCsv(await customersFile.text());
      customerErrors.push(...customersResult.errors);
      const result = await commitCustomers(supabase, created.entityId, customersResult.rows, "wave");
      if ("error" in result) throw new Error(result.error);
    }

    await supabase.from("import_jobs").update({ status: "completed", phase: "done" }).eq("id", job.id);
    return NextResponse.json({ jobId: job.id, entityId: created.entityId, warnings: [...accountErrors, ...customerErrors] });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Import failed";
    await supabase.from("import_jobs").update({ status: "failed", error_message: message }).eq("id", job.id);
    return NextResponse.json({ error: message, jobId: job.id }, { status: 500 });
  }
}
