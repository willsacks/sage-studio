import OAuthClient from "intuit-oauth";

const QBO_API_BASE: Record<"sandbox" | "production", string> = {
  sandbox: "https://sandbox-quickbooks.api.intuit.com",
  production: "https://quickbooks.api.intuit.com",
};

function getQboEnvironment(): "sandbox" | "production" {
  const env = process.env.QBO_ENVIRONMENT;
  return env === "production" ? "production" : "sandbox";
}

function getRedirectUri(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://sagestudio.org";
  return `${appUrl}/api/finance/qbo/callback`;
}

/** A fresh OAuthClient per call rather than a module-level singleton — this
 * client is stateful (it caches the current token on the instance), and
 * concurrent requests for different users/connections must never share one
 * mutable token holder. */
export function getQboOAuthClient(): OAuthClient {
  const clientId = process.env.QBO_CLIENT_ID;
  const clientSecret = process.env.QBO_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("QBO_CLIENT_ID / QBO_CLIENT_SECRET are not configured");

  return new OAuthClient({
    clientId,
    clientSecret,
    environment: getQboEnvironment(),
    redirectUri: getRedirectUri(),
  });
}

export class QboApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly intuitTid?: string) {
    super(message);
    this.name = "QboApiError";
  }
}

/**
 * Queries a QuickBooks object type via the Query endpoint's SQL-like
 * syntax, paginated via STARTPOSITION/MAXRESULTS. Throws QboApiError with
 * status 401 on an expired token (caller should refresh and retry once via
 * lib/finance/qbo-token.ts) rather than swallowing the distinction.
 */
export async function queryQbo<T>(params: {
  accessToken: string;
  realmId: string;
  environment: "sandbox" | "production";
  entity: string;
  whereClause?: string;
  startPosition?: number;
  maxResults?: number;
}): Promise<{ results: T[]; startPosition: number; maxResults: number }> {
  const { accessToken, realmId, environment, entity, whereClause, startPosition = 1, maxResults = 100 } = params;
  const query = `SELECT * FROM ${entity}${whereClause ? ` WHERE ${whereClause}` : ""} STARTPOSITION ${startPosition} MAXRESULTS ${maxResults}`;
  const url = `${QBO_API_BASE[environment]}/v3/company/${realmId}/query?query=${encodeURIComponent(query)}&minorversion=65`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  // Captured on every call (not just failures) — Intuit's own support team
  // uses intuit_tid to look up a specific request on their side, so it's
  // most valuable exactly when something goes wrong, but cheap enough to
  // always read off the response.
  const intuitTid = response.headers.get("intuit_tid") ?? undefined;

  if (!response.ok) {
    throw new QboApiError(
      `QuickBooks query failed for ${entity}: ${response.status} ${await response.text()}${intuitTid ? ` (intuit_tid: ${intuitTid})` : ""}`,
      response.status,
      intuitTid
    );
  }

  const body = await response.json();
  const results = (body?.QueryResponse?.[entity] ?? []) as T[];
  return { results, startPosition, maxResults };
}

/** Gets a total row count for a QuickBooks object type via COUNT(*), used
 * only to drive the import progress UI (progress_total) — never for
 * pagination logic itself, since QUERY's own STARTPOSITION/MAXRESULTS
 * response is the source of truth for whether more pages remain. */
export async function queryQboCount(params: {
  accessToken: string;
  realmId: string;
  environment: "sandbox" | "production";
  entity: string;
}): Promise<number> {
  const { accessToken, realmId, environment, entity } = params;
  const query = `SELECT COUNT(*) FROM ${entity}`;
  const url = `${QBO_API_BASE[environment]}/v3/company/${realmId}/query?query=${encodeURIComponent(query)}&minorversion=65`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });
  if (!response.ok) return 0;

  const body = await response.json();
  return Number(body?.QueryResponse?.totalCount ?? 0);
}

/**
 * Pages through an entire QuickBooks object type, calling onPage for each
 * page as it arrives (so callers can commit incrementally rather than
 * buffering a whole company file in memory). Stops early and reports
 * `done: false` if `deadline` is reached mid-pagination, so the chunked
 * import route can persist exactly which page to resume from rather than
 * re-fetching pages already committed.
 */
export async function queryQboAllPages<T>(params: {
  accessToken: string;
  realmId: string;
  environment: "sandbox" | "production";
  entity: string;
  whereClause?: string;
  startPosition: number;
  deadline: number;
  onPage: (rows: T[]) => Promise<void>;
}): Promise<{ done: boolean; nextStartPosition: number }> {
  const PAGE_SIZE = 100;
  let startPosition = params.startPosition;

  while (true) {
    if (Date.now() > params.deadline) return { done: false, nextStartPosition: startPosition };

    const { results } = await queryQbo<T>({
      accessToken: params.accessToken,
      realmId: params.realmId,
      environment: params.environment,
      entity: params.entity,
      whereClause: params.whereClause,
      startPosition,
      maxResults: PAGE_SIZE,
    });

    if (results.length > 0) await params.onPage(results);
    if (results.length < PAGE_SIZE) return { done: true, nextStartPosition: startPosition + results.length };
    startPosition += PAGE_SIZE;
  }
}
