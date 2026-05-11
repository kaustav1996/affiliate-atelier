"use client";

import { useState } from "react";

export function CopyAffiliateLink({ slug }: { slug: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "manual">("idle");
  const href = typeof window === "undefined" ? `/a/${slug}` : `${window.location.origin}/a/${slug}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(href);
      setStatus("copied");
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = href;
      textarea.setAttribute("readonly", "true");
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();

      const copied = document.execCommand("copy");
      document.body.removeChild(textarea);
      setStatus(copied ? "copied" : "manual");
    }

    window.setTimeout(() => setStatus("idle"), 2500);
  }

  return (
    <div className="copy-link-wrap">
      <button className="secondary-action" onClick={copy}>
        {status === "copied" ? "Copied link" : "Copy affiliate link"}
      </button>
      {status === "manual" ? <input readOnly value={href} onFocus={(event) => event.target.select()} /> : null}
    </div>
  );
}
