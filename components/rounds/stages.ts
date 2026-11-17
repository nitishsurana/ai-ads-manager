import type { RoundStatusView } from "@/lib/round/schema";
import { STAGES, type Stage } from "@/lib/round/types";

export type StageKind = "done" | "active" | "failed" | "pending";

export type StageView = {
  stage: Stage;
  label: string;
  kind: StageKind;
  detail: string;
};

const LABELS: Record<Stage, string> = {
  writing_copy: "Writing copy",
  making_backgrounds: "Making backgrounds",
  compositing: "Compositing",
  checking_quality: "Checking quality",
};

export const angleLabel = (angle: string) => {
  const text = angle.replaceAll("_", " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
};

// Four tiles from the round's status: the stages before the current one are done, the current one is active (failed once the round stopped there) and later ones wait. A round with no creative to show finished every stage.
export function stageViews(status: RoundStatusView): StageView[] {
  const running = status.status === "queued" || status.status === "running";
  const stopped = status.status === "failed" || status.status === "timed_out";
  const current =
    status.status === "queued"
      ? -1
      : Math.max(0, status.stage ? STAGES.indexOf(status.stage) : 0);

  return STAGES.map((stage, index) => {
    const count = status.counts[stage];
    const kind: StageKind =
      status.status === "no_pass" || (current >= 0 && index < current)
        ? "done"
        : index === current
          ? stopped
            ? "failed"
            : "active"
          : "pending";
    const total = count?.total ?? 0;
    const progress = total > 0 ? `${count?.done} of ${total}` : "";
    const detail =
      kind === "done"
        ? stage === "writing_copy"
          ? `${total} headlines and CTAs`
          : `${progress} done`
        : kind === "active"
          ? progress || "Starting"
          : kind === "failed"
            ? progress
              ? `Stopped at ${progress}`
              : "Stopped"
            : running && index === current + 1
              ? "Next"
              : "Not started";
    return { stage, label: LABELS[stage], kind, detail };
  });
}

// Share of the bar: each stage is a quarter, the current one by how many of its candidates are done.
export function progressShare(status: RoundStatusView) {
  const views = stageViews(status);
  const share = views.reduce((sum, view) => {
    if (view.kind === "done") return sum + 1;
    const count = status.counts[view.stage];
    return view.kind === "active" && count && count.total > 0
      ? sum + count.done / count.total
      : sum;
  }, 0);
  return Math.round((share / STAGES.length) * 100);
}

export function elapsedLabel(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return minutes > 0 ? `${minutes} min ${rest} s` : `${rest} s`;
}
