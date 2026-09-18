"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateAccountProfile, updateAccountEmail } from "@/lib/actions/profile";

export function AccountForm({
  initialDisplayName,
  initialUsername,
  currentEmail,
}: {
  initialDisplayName: string;
  initialUsername: string;
  currentEmail: string;
}) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [username, setUsername] = useState(initialUsername);
  const [email, setEmail] = useState(currentEmail);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSaved, setProfileSaved] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [savingProfile, startSavingProfile] = useTransition();
  const [savingEmail, startSavingEmail] = useTransition();

  function handleSaveProfile() {
    setProfileError(null);
    setProfileSaved(false);
    startSavingProfile(async () => {
      const result = await updateAccountProfile({ displayName, username });
      if (result?.error) { setProfileError(result.error); return; }
      setProfileSaved(true);
      router.refresh();
    });
  }

  function handleSaveEmail() {
    setEmailError(null);
    setEmailSent(false);
    if (email.trim().toLowerCase() === currentEmail.toLowerCase()) return;
    startSavingEmail(async () => {
      const result = await updateAccountEmail(email);
      if (result?.error) { setEmailError(result.error); return; }
      setEmailSent(true);
    });
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="display-name">Name</Label>
        <Input id="display-name" value={displayName} onChange={(e) => { setDisplayName(e.target.value); setProfileSaved(false); }} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="username">Username</Label>
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-[var(--muted-foreground)]">@</span>
          <Input id="username" value={username} onChange={(e) => { setUsername(e.target.value); setProfileSaved(false); }} />
        </div>
      </div>
      {profileError && <p className="text-sm text-red-500">{profileError}</p>}
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={handleSaveProfile} disabled={savingProfile}>
          {savingProfile && <Loader2 size={13} className="animate-spin mr-1.5" />}
          Save
        </Button>
        {profileSaved && <span className="text-sm text-emerald-600">Saved.</span>}
      </div>

      <div className="border-t border-[var(--border)] pt-5 space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" value={email} onChange={(e) => { setEmail(e.target.value); setEmailSent(false); }} />
        <p className="text-xs text-[var(--muted-foreground)]">Changing this sends a confirmation link to the new address — it won't take effect until you click it.</p>
        {emailError && <p className="text-sm text-red-500">{emailError}</p>}
        {emailSent && <p className="text-sm text-emerald-600">Check {email} for a confirmation link.</p>}
        <Button
          size="sm"
          variant="outline"
          onClick={handleSaveEmail}
          disabled={savingEmail || email.trim().toLowerCase() === currentEmail.toLowerCase()}
        >
          {savingEmail && <Loader2 size={13} className="animate-spin mr-1.5" />}
          Update email
        </Button>
      </div>
    </div>
  );
}
