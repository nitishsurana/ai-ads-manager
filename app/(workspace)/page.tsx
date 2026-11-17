import { StepCard } from "@/components/chat/step-card";
import { WorkspaceShell } from "@/components/layout/workspace-shell";
import { Alert } from "@/components/ui/alert";
import { requireTester } from "@/lib/auth";
import { ensureCurrentThread } from "@/lib/chat";

export default async function Page() {
  const { userId } = await requireTester();
  const threadId = await ensureCurrentThread(userId);

  return (
    <WorkspaceShell threadId={threadId}>
      <div className="mx-auto flex w-full max-w-[820px] flex-col gap-7">
        <div className="flex flex-col gap-2">
          <h1 className="m-0 text-[26px] font-semibold tracking-tight">
            Start with a product link
          </h1>
          <p className="m-0 max-w-[560px] text-[15px] text-muted-foreground">
            Paste a Shopify product page in the chat. Add an occasion or
            audience if you have one. Here’s what happens next.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <StepCard
            n={1}
            art="photos"
            title="Confirm what we found"
            body="We read the page and show its photos, brand kit, price and rating. Fix anything before we make ads."
          />
          <StepCard
            n={2}
            art="creatives"
            title="Review creatives"
            body="Up to 3 static 9:16 ads per round. Edit the headline and CTA right on the ad, and download PNGs."
          />
          <StepCard
            n={3}
            art="ratings"
            title="Rate and repeat"
            body="Approve or reject each ad. Rejections need a reason. Your ratings and chat direction shape the next round."
          />
        </div>
        <Alert
          tone="info"
          message="What works for now: a single Shopify product page that’s for sale online, priced above $0, with at least one photo. Pre-order and in-store-only products aren’t supported yet."
        />
      </div>
    </WorkspaceShell>
  );
}
