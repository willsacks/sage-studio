const VERCEL_API = "https://api.vercel.com";
const TOKEN = process.env.VERCEL_API_TOKEN;
const PROJECT_ID = process.env.VERCEL_PROJECT_ID ?? "prj_0B7b2K09n0oyq9PnhLpLGj36qiSm";
const TEAM_ID = process.env.VERCEL_TEAM_ID ?? "team_6k3AgShQRUisLmj0qkF57dEy";

function headers() {
  return {
    Authorization: `Bearer ${TOKEN}`,
    "Content-Type": "application/json",
  };
}

export type DomainStatus =
  | "valid"          // DNS is correct, domain is live
  | "invalid"        // DNS not yet propagated
  | "pending"        // Added to Vercel, awaiting DNS
  | "error"          // API error or not configured
  | "not_configured"; // Domain not added to Vercel project yet

export type DomainInfo = {
  name: string;
  verified: boolean;
  status: DomainStatus;
  cname?: string;
  aValue?: string;
};

export async function addDomainToProject(domain: string): Promise<{ success: boolean; error?: string }> {
  if (!TOKEN) return { success: false, error: "VERCEL_API_TOKEN not configured" };

  const res = await fetch(
    `${VERCEL_API}/v10/projects/${PROJECT_ID}/domains?teamId=${TEAM_ID}`,
    {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ name: domain }),
    }
  );

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return { success: false, error: body?.error?.message ?? `HTTP ${res.status}` };
  }
  return { success: true };
}

export async function removeDomainFromProject(domain: string): Promise<{ success: boolean; error?: string }> {
  if (!TOKEN) return { success: false, error: "VERCEL_API_TOKEN not configured" };

  const res = await fetch(
    `${VERCEL_API}/v9/projects/${PROJECT_ID}/domains/${domain}?teamId=${TEAM_ID}`,
    { method: "DELETE", headers: headers() }
  );

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return { success: false, error: body?.error?.message ?? `HTTP ${res.status}` };
  }
  return { success: true };
}

export async function getDomainStatus(domain: string): Promise<DomainInfo> {
  if (!TOKEN) {
    return { name: domain, verified: false, status: "error" };
  }

  const res = await fetch(
    `${VERCEL_API}/v9/projects/${PROJECT_ID}/domains/${domain}?teamId=${TEAM_ID}`,
    { headers: headers() }
  );

  if (res.status === 404) {
    return { name: domain, verified: false, status: "not_configured" };
  }

  if (!res.ok) {
    return { name: domain, verified: false, status: "error" };
  }

  const data = await res.json();
  const verified = data.verified === true;

  return {
    name: domain,
    verified,
    status: verified ? "valid" : "pending",
    cname: "cname.vercel-dns.com",
    aValue: "76.76.21.21",
  };
}
