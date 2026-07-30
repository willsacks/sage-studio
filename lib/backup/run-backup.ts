import { gzipSync } from "zlib";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { createAdminClient } from "@/lib/supabase/server";
import { createR2Client, getR2BucketName } from "@/lib/backup/r2-client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

const PAGE_SIZE = 1000;
const STORAGE_BUCKETS = ["media", "announcement-images", "avatars", "offering-media"];

export interface BackupResult {
  date: string;
  tables: { name: string; rows: number; error?: string }[];
  buckets: { name: string; files: number; error?: string }[];
}

/** This project's Supabase database is shared by more than just Sage Studio
 * (CRM/pipeline, roadmap, booking, community, and other tables live here too),
 * so the table list is discovered at run time from PostgREST's own OpenAPI
 * schema rather than hardcoded — a hardcoded list would silently stop covering
 * new tables the moment anything else sharing this project adds one. */
async function discoverTables(): Promise<string[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const res = await fetch(`${url}/rest/v1/`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new Error(`Schema introspection failed: ${res.status}`);
  const json = await res.json();
  return Object.keys(json.definitions ?? {}).sort();
}

async function exportTable(admin: AnyClient, table: string): Promise<unknown[]> {
  const rows: unknown[] = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await admin.from(table).select("*").range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return rows;
}

async function listAllStorageFiles(admin: AnyClient, bucket: string, prefix = ""): Promise<string[]> {
  const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: 1000 });
  if (error) throw new Error(error.message);
  const files: string[] = [];
  for (const entry of data ?? []) {
    const fullPath = prefix ? `${prefix}/${entry.name}` : entry.name;
    // Supabase Storage represents folders as entries with no id/metadata.
    if (entry.id === null) {
      files.push(...(await listAllStorageFiles(admin, bucket, fullPath)));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

export async function runBackup(): Promise<BackupResult> {
  const date = new Date().toISOString().slice(0, 10);
  const admin = createAdminClient() as AnyClient;
  const r2 = createR2Client();
  const bucket = getR2BucketName();

  const result: BackupResult = { date, tables: [], buckets: [] };

  const tableNames = await discoverTables();
  for (const table of tableNames) {
    try {
      const rows = await exportTable(admin, table);
      const gz = gzipSync(Buffer.from(JSON.stringify(rows)));
      await r2.send(new PutObjectCommand({
        Bucket: bucket,
        Key: `backups/${date}/db/${table}.json.gz`,
        Body: gz,
        ContentType: "application/gzip",
        ContentEncoding: "gzip",
      }));
      result.tables.push({ name: table, rows: rows.length });
    } catch (err) {
      result.tables.push({ name: table, rows: 0, error: err instanceof Error ? err.message : String(err) });
    }
  }

  for (const storageBucket of STORAGE_BUCKETS) {
    try {
      const paths = await listAllStorageFiles(admin, storageBucket);
      for (const path of paths) {
        const { data, error } = await admin.storage.from(storageBucket).download(path);
        if (error) throw new Error(error.message);
        const buf = Buffer.from(await data.arrayBuffer());
        await r2.send(new PutObjectCommand({
          Bucket: bucket,
          Key: `backups/${date}/storage/${storageBucket}/${path}`,
          Body: buf,
        }));
      }
      result.buckets.push({ name: storageBucket, files: paths.length });
    } catch (err) {
      result.buckets.push({ name: storageBucket, files: 0, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return result;
}
