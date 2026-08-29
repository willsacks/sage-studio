"use client";

import { useCallback, useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import { Loader2, Landmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createPlaidLinkToken, exchangePlaidPublicToken } from "@/lib/actions/finance-bank";

export function ConnectBankButton({ entityId, onConnected }: { entityId: string; onConnected: () => void }) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startConnect() {
    setLoading(true);
    setError(null);
    const result = await createPlaidLinkToken(entityId);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    // OAuth-based institutions (most major US banks) navigate the whole
    // page away to the bank's own login and back — persisting these so
    // app/(dashboard)/finances/plaid-oauth/page.tsx can resume the exact
    // same Link session on return, since a fresh link token can't be
    // substituted mid-OAuth-flow.
    sessionStorage.setItem("plaid_link_token", result.linkToken!);
    sessionStorage.setItem("plaid_entity_id", entityId);
    setLinkToken(result.linkToken!);
  }

  const onSuccess = useCallback(
    async (publicToken: string | null) => {
      if (!publicToken) return;
      setLoading(true);
      const result = await exchangePlaidPublicToken({ entityId, publicToken });
      setLoading(false);
      setLinkToken(null);
      sessionStorage.removeItem("plaid_link_token");
      sessionStorage.removeItem("plaid_entity_id");
      if (result.error) {
        setError(result.error);
        return;
      }
      onConnected();
    },
    [entityId, onConnected]
  );

  const { open, ready } = usePlaidLink({ token: linkToken, onSuccess });

  useEffect(() => {
    if (linkToken && ready) open();
  }, [linkToken, ready, open]);

  return (
    <div className="space-y-2">
      <Button size="sm" onClick={startConnect} disabled={loading}>
        {loading ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <Landmark size={14} className="mr-1.5" />}
        Connect a bank or credit card
      </Button>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
