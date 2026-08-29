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
  constructor(message: string, public readonly status: number) {
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

  if (!response.ok) {
    throw new QboApiError(`QuickBooks query failed for ${entity}: ${response.status} ${await response.text()}`, response.status);
  }

  const body = await response.json();
  const results = (body?.QueryResponse?.[entity] ?? []) as T[];
  return { results, startPosition, maxResults };
}
