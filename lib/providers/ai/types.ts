import type { z } from "zod";

export type AiRequest<T> = {
  // The replay snapshot is keyed by aiSnapshotKey.
  task: string;
  inputSha256: string;
  model: string;
  system: string;
  prompt: string;
  // Names how the image was prepared (size, format), so a change re-keys replay entries.
  inputVersion?: string;
  // JPEG images, shown to the model in this order after the prompt.
  images?: Uint8Array[];
  // Overrides the default call timeout, for calls with a known size.
  timeoutMs?: number;
  schema: z.ZodType<T>;
};

export type AiResult<T> = { object: T; costUsd: number | null };

export type Ai = {
  generate<T>(request: AiRequest<T>): Promise<AiResult<T>>;
};

export type ResearchCost = {
  provider: "ai" | "firecrawl";
  model: string | null;
  usd: number | null;
};

export type ResearchResult = {
  notes: string[];
  sources: { label: string; href: string }[];
  costs: ResearchCost[];
};

export type Researcher = {
  research(topic: string): Promise<ResearchResult>;
};
