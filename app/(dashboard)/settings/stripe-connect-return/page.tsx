import { CheckCircle2, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";
import { ConnectStripeButton } from "@/components/settings/ConnectStripeButton";
import { redirect } from "next/navigation";

/** Stripe's return_url/refresh_url both land here. Re-checks the account's
 * status directly with Stripe on load (belt-and-suspenders alongside the
 * account.updated webhook, app/api/webhooks/stripe-connect/route.ts) since
 * a webhook can lag or, in local dev without a tunnel, never arrive at all. */
export default async function StripeConnectReturnPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_connect_account_id")
    .eq("id", user.id)
    .single();

  if (!profile?.stripe_connect_account_id) redirect("/settings");

  const account = await stripe.accounts.retrieve(profile.stripe_connect_account_id);
  const chargesEnabled = account.charges_enabled;
  const payoutsEnabled = account.payouts_enabled;

  await supabase
    .from("profiles")
    .update({ stripe_connect_charges_enabled: chargesEnabled, stripe_connect_payouts_enabled: payoutsEnabled })
    .eq("id", user.id);

  return (
    <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
      {chargesEnabled ? (
        <>
          <CheckCircle2 size={28} className="text-green-500" />
          <p className="text-sm font-medium">Stripe is connected</p>
          <p className="text-sm text-[var(--muted-foreground)] max-w-sm">
            Course payments will go directly to your own Stripe account from now on.
          </p>
        </>
      ) : (
        <>
          <AlertCircle size={28} className="text-amber-500" />
          <p className="text-sm font-medium">Onboarding isn&apos;t finished yet</p>
          <p className="text-sm text-[var(--muted-foreground)] max-w-sm">
            Stripe still needs a bit more information before you can accept payments.
          </p>
          <ConnectStripeButton label="Resume Stripe setup" />
        </>
      )}
    </div>
  );
}
