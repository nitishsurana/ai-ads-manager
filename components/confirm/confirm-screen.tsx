import { ArrowLeft, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { Stepper } from "@/components/layout/stepper";
import type { ConfirmScreenData } from "@/lib/workspace";
import { ConfirmForm } from "./confirm-form";

// "host/…/handle": enough to recognise the product without the full path.
function shortUrl(url: string) {
  const { host, pathname } = new URL(url);
  const handle = pathname.split("/").filter(Boolean).at(-1);
  return handle ? `${host}/…/${handle}` : host;
}

type ConfirmScreenProps = {
  screen: ConfirmScreenData;
  mode: "first" | "edit";
};

export function ConfirmScreen({ screen, mode }: ConfirmScreenProps) {
  return (
    <ConfirmForm
      screen={screen}
      mode={mode}
      header={
        <div className="flex flex-col gap-3">
          <Stepper step={1} />
          <div className="flex items-end justify-between gap-4">
            <div className="flex flex-col gap-1">
              <h1 className="m-0 text-2xl font-semibold tracking-tight">
                Confirm what we found
              </h1>
              <p className="m-0 text-muted-foreground">
                {mode === "edit"
                  ? "Update anything below. Changes apply from your next round."
                  : "Check and edit anything below. Nothing is made until you press Generate creatives."}
              </p>
            </div>
            <div className="flex items-center gap-4">
              {mode === "edit" && (
                <Link
                  href={`/w/${screen.id}`}
                  className="inline-flex items-center gap-1 text-xs whitespace-nowrap text-primary-text hover:underline"
                >
                  <ArrowLeft className="size-3" aria-hidden="true" />
                  Back to round
                </Link>
              )}
              <a
                href={screen.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-mono text-xs whitespace-nowrap text-primary-text hover:underline"
              >
                {shortUrl(screen.sourceUrl)}
                <ArrowUpRight className="size-3" aria-hidden="true" />
              </a>
            </div>
          </div>
        </div>
      }
    />
  );
}
