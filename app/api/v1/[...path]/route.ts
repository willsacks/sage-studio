import { NextRequest, NextResponse } from "next/server";
import { authenticateBearer } from "@/lib/server/auth/bearer";
import { findOperationByPath } from "@/lib/server/contract/registry";
import { runOperation } from "@/lib/server/contract/run-operation";
import { ISSUER } from "@/lib/server/auth/oauth-jwt";

export const maxDuration = 30;

const WWW_AUTHENTICATE = `Bearer resource_metadata="${ISSUER}/.well-known/oauth-protected-resource"`;

/** One catch-all route for every operation in the registry — matches
 * <op.http.method> /api/v1/<op.http.path>. GET operations (phase 1, read)
 * take their input from path params + query string; POST operations
 * (phase 2, write) take it from path params + JSON body. No workspace
 * segment in the path (unlike the spec this was adapted from): every
 * operation is already scoped to the authenticated principal's own
 * user_id by the RLS policies withRls/withRlsWrite set up, so there's
 * nothing else to put in the URL. */
async function handle(request: NextRequest, method: "GET" | "POST", path: string[]) {
  const pathStr = `/${path.join("/")}`;

  const auth = await authenticateBearer(request.headers.get("authorization"), "api");
  if (!auth.ok) {
    return NextResponse.json(
      { error: { code: "unauthenticated", message: auth.error } },
      { status: 401, headers: { "WWW-Authenticate": WWW_AUTHENTICATE } }
    );
  }

  const found = findOperationByPath(method, pathStr);
  if (!found) {
    return NextResponse.json({ error: { code: "not_found", message: "Unknown endpoint" } }, { status: 404 });
  }

  let body: Record<string, unknown> = {};
  if (method === "POST") {
    try {
      body = request.headers.get("content-length") === "0" ? {} : await request.json();
    } catch {
      return NextResponse.json({ error: { code: "invalid_input", message: "Malformed JSON body" } }, { status: 400 });
    }
  }
  const query = method === "GET" ? Object.fromEntries(request.nextUrl.searchParams.entries()) : {};
  const result = await runOperation(found.op, auth.principal, { ...found.params, ...query, ...body });

  if ("error" in result) {
    const status = { forbidden_scope: 403, not_found: 404, invalid_input: 400, conflict: 409 }[result.error.code] ?? 500;
    return NextResponse.json(result, { status });
  }
  return NextResponse.json(result, { headers: { "X-Request-Id": auth.principal.requestId } });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return handle(request, "GET", (await params).path);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return handle(request, "POST", (await params).path);
}
