import type { PoolClient } from "pg";

/** A minimal, deliberately narrow stand-in for the supabase-js query
 * builder, backed by the raw `pg` connection withRlsWrite already hands
 * operation handlers. Exists for exactly one reason: lib/finance/
 * import-commit.ts and lib/finance/ledger.ts are mature, carefully-tested
 * business logic (parent-account resolution, ledger balancing, invoice
 * status recomputation, lock-date checks...) written against
 * `SupabaseClient<Database> | any` — reimplementing that in raw SQL for
 * the API/MCP write path would duplicate real financial logic, which is
 * exactly the kind of thing that's supposed to exist in one place (see
 * how lib/finance/reports.ts was split into fetch+compute for the same
 * reason, M5). This shim instead makes the *existing* functions runnable
 * against ctx.db unmodified, inside the same withRlsWrite transaction —
 * RLS still applies, auth.uid() still resolves from the real principal,
 * exactly as it does for every other write op.
 *
 * Supports only the chain shapes those two files actually use: `.from()`,
 * `.select()`, `.insert()`, `.update()`, `.upsert()`, `.delete()`, `.eq()`
 * (repeatable), `.limit()`, `.single()`, `.maybeSingle()`, and plain
 * `await` for a multi-row select. Not a general PostgREST client — don't
 * reach for this from a new ops file without checking it actually covers
 * the chain shapes you need first. */

type Row = Record<string, unknown>;
interface Result<T> {
  data: T | null;
  error: { message: string; code?: string } | null;
}

class PgQueryBuilder<T = Row> implements PromiseLike<Result<T | T[]>> {
  private op: "select" | "insert" | "update" | "upsert" | "delete" = "select";
  private selectCols = "*";
  private selectCalled = false;
  private values: Row[] = [];
  private onConflictCols: string[] | null = null;
  private filters: [string, unknown][] = [];
  private limitN: number | null = null;
  private mode: "many" | "single" | "maybeSingle" = "many";

  constructor(private db: PoolClient, private table: string) {}

  select(cols: string) {
    this.selectCols = cols;
    this.selectCalled = true;
    return this;
  }
  insert(values: Row | Row[]) {
    this.op = "insert";
    this.values = Array.isArray(values) ? values : [values];
    return this;
  }
  update(values: Row) {
    this.op = "update";
    this.values = [values];
    return this;
  }
  upsert(values: Row | Row[], opts?: { onConflict?: string }) {
    this.op = "upsert";
    this.values = Array.isArray(values) ? values : [values];
    this.onConflictCols = opts?.onConflict ? opts.onConflict.split(",").map((s) => s.trim()) : null;
    return this;
  }
  delete() {
    this.op = "delete";
    return this;
  }
  eq(col: string, val: unknown) {
    this.filters.push([col, val]);
    return this;
  }
  limit(n: number) {
    this.limitN = n;
    return this;
  }
  single(): PromiseLike<Result<T>> {
    this.mode = "single";
    return this as unknown as PromiseLike<Result<T>>;
  }
  maybeSingle(): PromiseLike<Result<T | null>> {
    this.mode = "maybeSingle";
    return this as unknown as PromiseLike<Result<T | null>>;
  }

  then<TResult1 = Result<T | T[]>, TResult2 = never>(
    onfulfilled?: ((value: Result<T | T[]>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private whereClause(paramsOffset: number): { sql: string; params: unknown[] } {
    if (this.filters.length === 0) return { sql: "", params: [] };
    const params: unknown[] = [];
    const clauses = this.filters.map(([col, val], i) => {
      params.push(val);
      return `${col} = $${paramsOffset + i + 1}`;
    });
    return { sql: ` where ${clauses.join(" and ")}`, params };
  }

  private async execute(): Promise<Result<T | T[]>> {
    try {
      let sql: string;
      let params: unknown[];
      const table = `public.${this.table}`;

      if (this.op === "select") {
        const where = this.whereClause(0);
        sql = `select ${this.selectCols} from ${table}${where.sql}${this.limitN ? ` limit ${this.limitN}` : ""}`;
        params = where.params;
      } else if (this.op === "delete") {
        const where = this.whereClause(0);
        sql = `delete from ${table}${where.sql}`;
        params = where.params;
      } else if (this.op === "update") {
        const cols = Object.keys(this.values[0]);
        const setClause = cols.map((c, i) => `${c} = $${i + 1}`).join(", ");
        const where = this.whereClause(cols.length);
        sql = `update ${table} set ${setClause}${where.sql}${this.selectCalled ? ` returning ${this.selectCols}` : ""}`;
        params = [...cols.map((c) => this.values[0][c]), ...where.params];
      } else {
        // insert / upsert
        const cols = Object.keys(this.values[0]);
        const rowsSql = this.values
          .map((row, rowIdx) => `(${cols.map((_, colIdx) => `$${rowIdx * cols.length + colIdx + 1}`).join(", ")})`)
          .join(", ");
        params = this.values.flatMap((row) => cols.map((c) => row[c] ?? null));
        let conflictSql = "";
        if (this.op === "upsert" && this.onConflictCols) {
          const updateCols = cols.filter((c) => !this.onConflictCols!.includes(c));
          conflictSql = ` on conflict (${this.onConflictCols.join(", ")}) do update set ${updateCols.map((c) => `${c} = excluded.${c}`).join(", ")}`;
        }
        sql = `insert into ${table} (${cols.join(", ")}) values ${rowsSql}${conflictSql}${this.selectCalled ? ` returning ${this.selectCols}` : ""}`;
      }

      const result = await this.db.query(sql, params);
      const rows = result.rows as T[];

      if (this.mode === "single") {
        if (rows.length === 0) return { data: null, error: { message: "No rows found", code: "PGRST116" } };
        return { data: rows[0], error: null };
      }
      if (this.mode === "maybeSingle") {
        return { data: rows[0] ?? null, error: null };
      }
      return { data: rows, error: null };
    } catch (err) {
      return { data: null, error: { message: err instanceof Error ? err.message : "Database error" } };
    }
  }
}

export class PgSupabaseShim {
  constructor(private db: PoolClient) {}
  from<T = Row>(table: string): PgQueryBuilder<T> {
    return new PgQueryBuilder<T>(this.db, table);
  }
}
