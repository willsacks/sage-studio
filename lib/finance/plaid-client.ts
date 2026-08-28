import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";

let client: PlaidApi | null = null;

/** Single shared Plaid client — credentials come from headers, not the
 * request body, so callers never need to touch the client_id/secret. */
export function getPlaidClient(): PlaidApi {
  if (client) return client;

  const env = process.env.PLAID_ENV ?? "sandbox";
  const basePath = PlaidEnvironments[env as keyof typeof PlaidEnvironments];
  if (!basePath) throw new Error(`Invalid PLAID_ENV: ${env}`);

  const configuration = new Configuration({
    basePath,
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
        "PLAID-SECRET": process.env.PLAID_SECRET,
      },
    },
  });

  client = new PlaidApi(configuration);
  return client;
}
