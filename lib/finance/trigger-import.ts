import { after } from "next/server";

/**
 * Kicks off (or continues) the chunked QuickBooks/Wave import runner
 * without blocking the caller's own response on it finishing.
 *
 * A bare `fetch(url).catch(() => {})` called right before `return` looks
 * like a standard fire-and-forget pattern, but on Vercel's serverless
 * runtime it isn't reliable — the function's compute can be frozen the
 * moment the response is sent, which can kill the outbound request before
 * it's even dispatched. `after()` (next/server) is Vercel's documented fix:
 * it keeps the invocation alive until the passed callback settles. We still
 * don't want to wait for the full import to finish (it can run for
 * minutes), so the fetch here is given a short abort timeout — once
 * Vercel's platform has accepted and started the destination invocation,
 * that invocation keeps running on its own regardless of whether this
 * caller's socket is still open.
 */
export function triggerImportRun(url: string, jobId: string) {
  after(async () => {
    try {
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
        signal: AbortSignal.timeout(8_000),
      });
    } catch {
      // Expected: we abort our own wait once the request has been sent —
      // this does not mean the destination invocation failed to start.
    }
  });
}
