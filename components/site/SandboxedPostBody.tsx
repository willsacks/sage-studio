"use client";

import { useEffect, useRef, useState } from "react";

/** Renders a post's author-controlled HTML the same iframe-sandboxed way
 * site_pages' html_content is rendered (see app/sites/[slug]/page.tsx) —
 * that sandbox (no allow-same-origin) is a deliberate, already-audited fix
 * for exactly this content model: raw HTML+JS is a real feature here (not
 * sanitized on write), so it must never run in the real top-level document
 * where it could reach window.top as same-origin. Unlike a full standalone
 * page, a post body is embedded inline within normal page chrome (nav,
 * other post content), so it needs to report its own height back to size
 * the iframe instead of being full-viewport. */
export function SandboxedPostBody({ html }: { html: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(200);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.source === iframeRef.current?.contentWindow && typeof e.data?.sagePostHeight === "number") {
        setHeight(Math.max(100, e.data.sagePostHeight));
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const srcDoc = `<!doctype html><html><head><base target="_parent"><meta name="viewport" content="width=device-width, initial-scale=1"><style>
    html,body{margin:0;padding:0;font-family:inherit;}
    img,video,iframe{max-width:100%;}
  </style></head><body>${html}<script>
    function report() { try { parent.postMessage({ sagePostHeight: document.documentElement.scrollHeight }, "*"); } catch (e) {} }
    window.addEventListener("load", report);
    window.addEventListener("resize", report);
    if (window.ResizeObserver) new ResizeObserver(report).observe(document.body);
    report();
    setTimeout(report, 300);
  </script></body></html>`;

  return (
    <iframe
      ref={iframeRef}
      srcDoc={srcDoc}
      style={{ width: "100%", height, border: "none", display: "block" }}
      sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms allow-top-navigation-by-user-activation"
      title="Post content"
    />
  );
}
