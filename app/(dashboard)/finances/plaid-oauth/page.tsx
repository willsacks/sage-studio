"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePlaidLink } from "react-plaid-link";
import { Loader2, AlertCircle } from "lucide-react";
import { exchangePlaidPublicToken } from "@/lib/actions/finance-bank";

// OAuth-based institutions (most major US banks — Chase, Bank of America,
// Wells Fargo, etc.) navigate the whole page away to the bank's own login
// page and back, rather than staying in Plaid's popup. Plaid's Dashboard
// must have this page's URL registered as an "Allowed redirect URI" (see
// PLAID_REDIRECT_URI in lib/actions/finance-bank.ts) for this flow to be
// offered at all — non-OAuth institutions never hit this page.
export default function PlaidOAuthReturnPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [entityId, setEntityId] = useState<string | null>(null);
  const [linkToken, setLinkToken] = useState<string | null>(null);

  useEffect(() => {
    const token = sessionStorage.getItem("plaid_link_token");
    const storedEntityId = sessionStorage.getItem("plaid_entity_id");
    if (!token || !storedEntityId) {
      setError("This link has expired or wasn't opened from a bank connection attempt. Please start over from the Bank Accounts tab.");
      return;
    }
    setLinkToken(token);
    setEntityId(storedEntityId);
  }, []);

  const onSuccess = useCallback(
    async (publicToken: string | null) => {
      sessionStorage.removeItem("plaid_link_token");
      sessionStorage.removeItem("plaid_entity_id");
      if (!publicToken || !entityId) {
        router.replace("/finances");
        return;
      }
      const result = await exchangePlaidPublicToken({ entityId, publicToken });
      if (result.error) {
        setError(result.error);
        return;
      }
      router.replace("/finances");
    },
    [entityId, router]
  );

  const onExit = useCallback(() => {
    sessionStorage.removeItem("plaid_link_token");
    sessionStorage.removeItem("plaid_entity_id");
    router.replace("/finances");
  }, [router]);

  const { open, ready } = usePlaidLink({
    token: linkToken,
    receivedRedirectUri: typeof window !== "undefined" ? window.location.href : undefined,
    onSuccess,
    onExit,
  });

  useEffect(() => {
    if (linkToken && ready) open();
  }, [linkToken, ready, open]);

  return (
    <div className="flex flex-col items-center justify-center py-24 gap-3">
      {error ? (
        <>
          <AlertCircle size={24} className="text-red-500" />
          <p className="text-sm text-[var(--muted-foreground)] max-w-sm text-center">{error}</p>
        </>
      ) : (
        <>
          <Loader2 size={24} className="animate-spin text-[var(--muted-foreground)]" />
          <p className="text-sm text-[var(--muted-foreground)]">Finishing bank connection...</p>
        </>
      )}
    </div>
  );
}
