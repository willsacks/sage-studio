# Testing and verification

The repo has no unit-test suite. The checks below are what count as verified.

## Always

```bash
npx tsc --noEmit        # typecheck
npm run build           # runs scripts/ci-safety-checks.ts (prebuild), then next build
```

Vercel builds a preview deployment for every PR, and that build runs the safety check and the typecheck.

## Disposable scripts against the real database

There's no staging, so data-path checks run against production. Put them in temporary `scripts/tmp-*.ts` files, use test data you create yourself, and delete both the data and the script before committing. Unattended agents should skip this. Describe in the PR what the human should check instead.

## Testing as a real signed-in user (RLS, permissions, browser-only bugs)

Auth is magic-link only, so you get a real session like this:

1. Install Playwright temporarily: `npm i -D playwright && npx playwright install chromium`. Don't commit `package.json` / `package-lock.json` changes from this.
2. Create a disposable user with `admin.auth.admin.createUser({ email, password, email_confirm: true })`. This **skips the signup trigger**, so also insert a matching `profiles` row with `onboarding_done: true`.
3. Get tokens without a password:
   1. `admin.auth.admin.generateLink({ type: "magiclink", email })`
   2. Take `properties.hashed_token`.
   3. Call `anon.auth.verifyOtp({ token_hash, type: "magiclink" })` to get `access_token` / `refresh_token`.
4. For RLS checks, build a client from that session and try the reads and writes directly.
5. For browser checks:
   1. Navigate to the site first, so the cookie domain is set.
   2. In `page.evaluate`, dynamically `import("https://esm.sh/@supabase/ssr@<version>")`.
   3. Create the browser client and call `.auth.setSession(...)`. Don't hand-craft auth cookies.
6. To see the real server error, start `npx vercel logs <deployment-url>` in a parallel shell **before** triggering the request. The buffer is short and only tails live.
7. Clean up: delete the user's data, the `profiles` row, and the user (check the error, since some FKs don't cascade), then uninstall Playwright and delete the temp scripts.

## Security-sensitive changes

For anything touching auth, OAuth, the public API, webhooks, file uploads, or URL fetching, do a separate security pass after it works:
- Do SSRF guards cover IPv6 and IPv4-mapped addresses?
- Are redirect URIs checked against an allowlist of schemes?
- Is every untrusted parameter validated, not just stored?
- Are security events written to the audit log?

Functional tests missed all four of these the last time.
