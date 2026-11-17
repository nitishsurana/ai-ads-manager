import type { JudgeRecord } from "@/lib/round";

export type BrandChange = { field: string; scraped: string; edited: string };

export type AdminCreative = {
  n: number;
  angle: string;
  previewPath: string;
  previewUrl: string | null;
  rating: "approve" | "reject" | null;
  tags: string[];
  note: string | null;
  edits: number;
  judge: JudgeRecord | null;
};

export type AdminRound = {
  id: string;
  tester: string;
  golden: boolean;
  workspaceId: string;
  title: string;
  store: string;
  sourceUrl: string;
  deleted: boolean;
  // Null for a workspace that has no round yet.
  n: number | null;
  attempt: number;
  status: string;
  // The round's start, or the workspace's creation for a row with no round.
  startedAt: string;
  durationS: number | null;
  briefVersion: number;
  creatives: AdminCreative[];
  cost: number;
  // The workspace's costs that belong to no round (reading the product, chat, tools); counted once per workspace in a total.
  setupCost: number;
  // Null when a stored brand kit could not be read.
  brandChanges: BrandChange[] | null;
};
