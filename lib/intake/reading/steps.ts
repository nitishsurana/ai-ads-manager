import type { Step1FailureCode } from "@/lib/messages";
import type { ReadingStatus } from "./schema";

export type StepKind = "done" | "active" | "failed" | "pending";

export type Step = { kind: StepKind; label: string; detail: string };

const STEPS = [
  { label: "Checking the link", detail: "It’s a Shopify product page" },
  { label: "Reading the product", detail: "Title, price and options" },
  { label: "Collecting photos", detail: "Photos checked" },
  {
    label: "Building the brand kit",
    detail: "Logo, colours, typeface and tone",
  },
] as const;

const STAGE_INDEX = { product: 1, photos: 2, brand: 3 } as const;

const FAILED_AT: Partial<Record<Step1FailureCode, number>> = {
  url_malformed: 0,
  not_shopify: 0,
  not_a_product: 0,
  no_photos: 2,
};

function activeDetail({ phase, done, total }: ReadingStatus) {
  if (total === null || done === null) return "Finding photos";
  return `${done} of ${total} ${phase === "reading" ? "read" : "checked"}`;
}

function productDetail({ product }: ReadingStatus) {
  if (!product) return STEPS[1].detail;
  return product.price ? `${product.title} · ${product.price}` : product.title;
}

export function stepsFor(status: ReadingStatus): Step[] {
  // The link counts as checked once the store check has passed: the product is known, or a later stage began.
  const current =
    status.stage === "product"
      ? status.product
        ? 1
        : 0
      : STAGE_INDEX[status.stage];
  const failed = status.status === "failed";
  const failedAt = failed
    ? (FAILED_AT[status.failure?.code ?? "intake_failed"] ?? current)
    : -1;
  const doneBefore = failed ? failedAt : current;

  return STEPS.map((step, index): Step => {
    const detail = index === 1 ? productDetail(status) : step.detail;
    if (status.status === "done" || index < doneBefore) {
      return { kind: "done", label: step.label, detail };
    }
    if (index === failedAt) {
      return { kind: "failed", label: step.label, detail: "Couldn’t continue" };
    }
    if (failed) {
      return { kind: "pending", label: step.label, detail: "Skipped" };
    }
    if (index === current) {
      return {
        kind: "active",
        label: step.label,
        detail: index === 2 ? activeDetail(status) : detail,
      };
    }
    return { kind: "pending", label: step.label, detail };
  });
}
