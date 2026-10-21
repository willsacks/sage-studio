import { createMcpHandler, withMcpAuth } from "mcp-handler";
import type { AuthInfo } from "@modelcontextprotocol/server";
import { authenticateBearer } from "@/lib/server/auth/bearer";
import { operations } from "@/lib/server/contract/registry";
import { runOperation } from "@/lib/server/contract/run-operation";
import { ISSUER } from "@/lib/server/auth/oauth-jwt";
import { ALL_MODULES, type Principal } from "@/lib/server/auth/principal";

/** Every operation in the registry, exposed as an MCP tool under the
 * exact same name/schema/handler the REST API uses (lib/server/contract/
 * registry.ts) — one service layer, two adapters. Scope enforcement
 * happens inside runOperation, identically to REST, rather than by
 * filtering tools/list per connection: a denied tool call returns a
 * clear isError result instead of the tool being hidden, which keeps
 * this handler stateless (no per-request tool registration) and matches
 * what the REST API already does for the same scope gap. */
const handler = createMcpHandler(
  (server) => {
    for (const op of operations) {
      server.registerTool(
        op.tool,
        { title: op.title, description: op.description, inputSchema: op.input, outputSchema: op.output },
        async (args, ctx) => {
          const authInfo = ctx.http?.authInfo;
          const principal = authInfo?.extra?.principal as Principal | undefined;
          if (!principal) {
            return { content: [{ type: "text", text: "Unauthorized" }], isError: true };
          }
          const result = await runOperation(op, principal, args);
          if ("error" in result) {
            return { content: [{ type: "text", text: result.error.message }], isError: true };
          }
          return {
            content: [{ type: "text", text: JSON.stringify(result.data) }],
            structuredContent: result.data as Record<string, unknown>,
          };
        }
      );
    }
  },
  { serverInfo: { name: "Sage Studio", version: "1.0.0" } }
);

async function verifyToken(_req: Request, bearerToken?: string): Promise<AuthInfo | undefined> {
  if (!bearerToken) return undefined;
  const result = await authenticateBearer(`Bearer ${bearerToken}`, "mcp");
  if (!result.ok) return undefined;
  const principal = result.principal;
  const scopes = ALL_MODULES.filter((m) => principal.scopes[m] !== "none").map((m) => `${m}:${principal.scopes[m]}`);
  return {
    token: bearerToken,
    clientId: principal.clientId ?? "unknown",
    scopes,
    resource: new URL(ISSUER),
    extra: { principal },
  };
}

const authedHandler = withMcpAuth(handler, verifyToken, {
  required: true,
  resourceMetadataPath: "/.well-known/oauth-protected-resource",
});

export { authedHandler as GET, authedHandler as POST };
