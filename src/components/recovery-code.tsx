"use client";

import { useState } from "react";
import { Button } from "./ui";

/** Shows a freshly issued recovery code with copy / download, gated on "I've saved it". */
export function RecoveryCodeCard({
  code,
  username,
  onContinue,
  continueLabel = "Continue"
}: {
  code: string;
  username: string;
  onContinue: () => void;
  continueLabel?: string;
}) {
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked — the code is still visible */
    }
  }

  function download() {
    const text = `Edgify recovery code\n\nUsername: ${username}\nRecovery code: ${code}\n\nUse it at edgify.cc/forgot if you forget your password. Each code works once.\n`;
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `edgify-recovery-${username}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col items-center text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden className="text-accent">
          <rect x="4.5" y="10.5" width="15" height="10" rx="3" stroke="currentColor" strokeWidth="1.8" />
          <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </span>
      <h2 className="display mt-5 text-[26px]">Save your recovery code</h2>
      <p className="mt-1.5 max-w-xs text-[15px] text-ink-3">
        It&apos;s the only way back into your account if you forget your password. We can&apos;t show it again.
      </p>
      <p className="mt-6 w-full select-all rounded-2xl bg-fill px-4 py-4 font-mono text-[20px] font-semibold tracking-[0.08em] text-ink">
        {code}
      </p>
      <div className="mt-3 flex w-full gap-2">
        <Button variant="plain" className="flex-1" onClick={copy}>
          {copied ? "Copied" : "Copy"}
        </Button>
        <Button variant="plain" className="flex-1" onClick={download}>
          Download
        </Button>
      </div>
      <label className="mt-5 flex cursor-pointer items-center gap-3 text-[15px] text-ink-2">
        <input
          type="checkbox"
          checked={saved}
          onChange={(e) => setSaved(e.target.checked)}
          className="h-[18px] w-[18px] accent-[#0071e3]"
        />
        I&apos;ve saved it somewhere safe
      </label>
      <Button size="lg" className="mt-5 w-full" disabled={!saved} onClick={onContinue}>
        {continueLabel}
      </Button>
    </div>
  );
}
