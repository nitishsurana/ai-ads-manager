"use client";

import { Download } from "lucide-react";
import { useState } from "react";
import { downloadPng, downloadZip } from "@/components/rounds/downloads";
import { messages } from "@/lib/messages";

const BUTTON =
  "inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-border bg-card px-3 text-[13px] font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50";

function DownloadButton({
  label,
  run,
}: {
  label: string;
  run: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const click = async () => {
    setBusy(true);
    setError(false);
    try {
      await run();
    } catch (cause) {
      console.error(`library: ${label} failed`, cause);
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button type="button" onClick={click} disabled={busy} className={BUTTON}>
        <Download className="size-3.5" aria-hidden="true" />
        {label}
      </button>
      {error && (
        <p role="alert" className="m-0 text-xs text-destructive">
          {messages.export_failed}
        </p>
      )}
    </div>
  );
}

export function DownloadPngButton({ creativeId }: { creativeId: string }) {
  return (
    <DownloadButton label="Download PNG" run={() => downloadPng(creativeId)} />
  );
}

export function DownloadZipButton({ creativeIds }: { creativeIds: string[] }) {
  return (
    <DownloadButton
      label="Download round as zip"
      run={() => downloadZip(creativeIds)}
    />
  );
}
