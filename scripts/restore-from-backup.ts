/**
 * Inspect (and, only when explicitly confirmed, restore from) a daily backup
 * written by app/api/cron/backup/route.ts to Cloudflare R2.
 *
 * This is deliberately NOT a one-click "restore everything" tool — blindly
 * overwriting live data with an old snapshot is its own way to lose data.
 * Default usage just lists/downloads a day's backup for inspection; actually
 * writing anything back to Supabase requires naming exactly one table or
 * bucket and passing --confirm.
 *
 * Usage:
 *   npx tsx scripts/restore-from-backup.ts 2026-07-30
 *     List everything in that day's backup (tables + row counts, bucket + file counts).
 *
 *   npx tsx scripts/restore-from-backup.ts 2026-07-30 --show-table=artist_sites
 *     Download and pretty-print one table's rows without writing anything.
 *
 *   npx tsx scripts/restore-from-backup.ts 2026-07-30 --restore-table=artist_sites --confirm
 *     Upsert that table's backed-up rows back into Supabase (by id). Does not
 *     delete rows that exist now but didn't exist in the backup.
 *
 *   npx tsx scripts/restore-from-backup.ts 2026-07-30 --restore-bucket=offering-media --confirm
 *     Re-upload that bucket's backed-up files back into Supabase Storage.
 */
import { gunzipSync } from "zlib";
import { readFileSync } from "fs";
import { resolve } from "path";
import { ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";
import { createR2Client, getR2BucketName } from "../lib/backup/r2-client";

// Plain `tsx` execution doesn't auto-load .env.local the way Next.js does, so
// parse it manually (matches the convention every other scripts/*.ts file here uses).
const envContent = readFileSync(resolve(process.cwd(), ".env.local"), "utf-8");
for (const line of envContent.split("\n")) {
  const match = line.match(/^([A-Z_]+)=(.*)$/);
  if (match) process.env[match[1]] = match[2].replace(/^"|"$/g, "");
}

function createAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function streamToBuffer(body: unknown): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chunks: Uint8Array[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for await (const chunk of body as any) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function main() {
  const [date, ...flags] = process.argv.slice(2);
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    console.error("Usage: npx tsx scripts/restore-from-backup.ts YYYY-MM-DD [--show-table=name | --restore-table=name --confirm | --restore-bucket=name --confirm]");
    process.exit(1);
  }

  const showTable = flags.find((f) => f.startsWith("--show-table="))?.split("=")[1];
  const restoreTable = flags.find((f) => f.startsWith("--restore-table="))?.split("=")[1];
  const restoreBucket = flags.find((f) => f.startsWith("--restore-bucket="))?.split("=")[1];
  const confirmed = flags.includes("--confirm");

  const r2 = createR2Client();
  const bucket = getR2BucketName();
  const prefix = `backups/${date}/`;

  const listed = await r2.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix }));
  const keys = (listed.Contents ?? []).map((o) => o.Key!).filter(Boolean);
  if (keys.length === 0) {
    console.error(`No backup found under ${prefix} — check the date and CLOUDFLARE_R2_BUCKET_NAME.`);
    process.exit(1);
  }

  if (!showTable && !restoreTable && !restoreBucket) {
    const dbKeys = keys.filter((k) => k.includes("/db/"));
    const storageKeys = keys.filter((k) => k.includes("/storage/"));
    console.log(`Backup for ${date}: ${dbKeys.length} tables, ${storageKeys.length} storage files.\n`);
    console.log("Tables:");
    for (const k of dbKeys) console.log(`  ${k.split("/db/")[1].replace(".json.gz", "")}`);
    const bucketsSeen = new Set(storageKeys.map((k) => k.split("/storage/")[1]?.split("/")[0]));
    console.log("\nStorage buckets:");
    for (const b of bucketsSeen) console.log(`  ${b} (${storageKeys.filter((k) => k.includes(`/storage/${b}/`)).length} files)`);
    console.log("\nPass --show-table=<name>, --restore-table=<name> --confirm, or --restore-bucket=<name> --confirm.");
    return;
  }

  if (showTable) {
    const key = `${prefix}db/${showTable}.json.gz`;
    const obj = await r2.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const rows = JSON.parse(gunzipSync(await streamToBuffer(obj.Body)).toString("utf8"));
    console.log(`${showTable}: ${rows.length} rows\n`);
    console.log(JSON.stringify(rows, null, 2));
    return;
  }

  if (!confirmed) {
    console.error("Restore actions require --confirm. Run without it first to inspect (--show-table=<name>).");
    process.exit(1);
  }

  const admin = createAdminClient();

  if (restoreTable) {
    const key = `${prefix}db/${restoreTable}.json.gz`;
    const obj = await r2.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const rows = JSON.parse(gunzipSync(await streamToBuffer(obj.Body)).toString("utf8")) as Record<string, unknown>[];
    console.log(`Restoring ${rows.length} rows into "${restoreTable}" (upsert by id)...`);
    const CHUNK = 500;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const { error } = await admin.from(restoreTable).upsert(rows.slice(i, i + CHUNK));
      if (error) throw new Error(`Upsert failed at row ${i}: ${error.message}`);
    }
    console.log("Done. Note: this does not delete rows that exist now but weren't in the backup.");
    return;
  }

  if (restoreBucket) {
    const bucketPrefix = `${prefix}storage/${restoreBucket}/`;
    const bucketListed = await r2.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: bucketPrefix }));
    const fileKeys = (bucketListed.Contents ?? []).map((o) => o.Key!).filter(Boolean);
    console.log(`Restoring ${fileKeys.length} files into Storage bucket "${restoreBucket}"...`);
    for (const key of fileKeys) {
      const path = key.slice(bucketPrefix.length);
      const obj = await r2.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      const buf = await streamToBuffer(obj.Body);
      const { error } = await admin.storage.from(restoreBucket).upload(path, buf, { upsert: true });
      if (error) throw new Error(`Upload failed for ${path}: ${error.message}`);
    }
    console.log("Done.");
    return;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
