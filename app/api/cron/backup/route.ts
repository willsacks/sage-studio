import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { runBackup, type BackupResult } from "@/lib/backup/run-backup";

export const maxDuration = 300;

const resend = new Resend(process.env.RESEND_API_KEY);

function summarize(result: BackupResult) {
  const failedTables = result.tables.filter((t) => t.error);
  const failedBuckets = result.buckets.filter((b) => b.error);
  const totalRows = result.tables.reduce((sum, t) => sum + t.rows, 0);
  const totalFiles = result.buckets.reduce((sum, b) => sum + b.files, 0);
  return { failedTables, failedBuckets, totalRows, totalFiles };
}

async function sendFailureAlert(subject: string, details: string) {
  const to = process.env.BACKUP_ALERT_EMAIL;
  if (!to) return;
  try {
    await resend.emails.send({
      from: "Sage Studio <notifications@sagestudio.org>",
      to,
      subject,
      html: `<pre style="font-family:monospace;white-space:pre-wrap">${details}</pre>`,
    });
  } catch (emailErr) {
    console.error("backup alert email failed to send:", emailErr);
  }
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  // Guard against an unset/empty CRON_SECRET making this trivially bypassable
  // (e.g. `Bearer ` matching an empty secret) — require a real configured value.
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runBackup();
    const { failedTables, failedBuckets, totalRows, totalFiles } = summarize(result);

    console.log(`[backup] ${result.date}: ${result.tables.length} tables (${totalRows} rows), ${result.buckets.length} buckets (${totalFiles} files), ${failedTables.length + failedBuckets.length} failures`);

    if (failedTables.length > 0 || failedBuckets.length > 0) {
      const details = [
        ...failedTables.map((t) => `table ${t.name}: ${t.error}`),
        ...failedBuckets.map((b) => `bucket ${b.name}: ${b.error}`),
      ].join("\n");
      await sendFailureAlert(
        `Sage Studio backup partially failed (${result.date})`,
        `${failedTables.length + failedBuckets.length} of ${result.tables.length + result.buckets.length} items failed:\n\n${details}`
      );
    }

    return NextResponse.json({ ok: true, ...result, summary: { totalRows, totalFiles, failures: failedTables.length + failedBuckets.length } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[backup] job failed entirely:", message);
    await sendFailureAlert("Sage Studio backup failed", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
