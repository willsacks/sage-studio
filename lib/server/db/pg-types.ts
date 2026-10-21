import { types } from "pg";

/** node-postgres auto-parses timestamp/date columns into JS Date objects
 * by default — but every operation's zod output schema expects ISO
 * strings (matching what supabase-js/PostgREST already return
 * everywhere else in this codebase). Importing this once, before any
 * pool is created, makes `pg` hand back the raw string instead, so
 * `z.string()` on a timestamp column doesn't throw at the output.parse
 * step. Side-effecting on purpose — import for effect only. */
types.setTypeParser(types.builtins.TIMESTAMPTZ, (val) => val);
types.setTypeParser(types.builtins.TIMESTAMP, (val) => val);
types.setTypeParser(types.builtins.DATE, (val) => val);
