import "server-only";
import { z } from "zod";
import type { Json } from "../database.types";
import { createSecretClient } from "../secret";
import { check } from "./error";

const ROUND_STATUSES = [
  "queued",
  "running",
  "done",
  "failed",
  "timed_out",
  "no_pass",
] as const;

const roundRowSchema = z.object({
  id: z.string(),
  workspace_id: z.string(),
  n: z.number(),
  attempt: z.number(),
  status: z.enum(ROUND_STATUSES),
  stage: z
    .enum([
      "writing_copy",
      "making_backgrounds",
      "compositing",
      "checking_quality",
    ])
    .nullable(),
  progress: z.unknown(),
  inputs: z.unknown(),
  brief_version: z.number(),
  started_at: z.string(),
  running_at: z.string().nullable(),
  deadline_at: z.string().nullable(),
  finished_at: z.string().nullable(),
});

export type RoundStatus = (typeof ROUND_STATUSES)[number];

export type Round = {
  id: string;
  workspaceId: string;
  n: number;
  attempt: number;
  status: RoundStatus;
  stage: z.infer<typeof roundRowSchema>["stage"];
  progress: unknown;
  inputs: unknown;
  briefVersion: number;
  startedAt: string;
  runningAt: string | null;
  deadlineAt: string | null;
  finishedAt: string | null;
};

const COLUMNS =
  "id, workspace_id, n, attempt, status, stage, progress, inputs, brief_version, started_at, running_at, deadline_at, finished_at";

function toRound(row: unknown): Round {
  const parsed = roundRowSchema.parse(row);
  return {
    id: parsed.id,
    workspaceId: parsed.workspace_id,
    n: parsed.n,
    attempt: parsed.attempt,
    status: parsed.status,
    stage: parsed.stage,
    progress: parsed.progress,
    inputs: parsed.inputs,
    briefVersion: parsed.brief_version,
    startedAt: parsed.started_at,
    runningAt: parsed.running_at,
    deadlineAt: parsed.deadline_at,
    finishedAt: parsed.finished_at,
  };
}

export async function getRound(userId: string, id: string) {
  const { data, error } = await createSecretClient()
    .from("rounds")
    .select(COLUMNS)
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  check(error, "get round");
  return data ? toRound(data) : null;
}

export async function getLatestRound(userId: string, workspaceId: string) {
  const { data, error } = await createSecretClient()
    .from("rounds")
    .select(COLUMNS)
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .order("n", { ascending: false })
    .order("attempt", { ascending: false })
    .limit(1)
    .maybeSingle();
  check(error, "get latest round");
  return data ? toRound(data) : null;
}

// The finished attempt of round n, if there is one.
export async function getDoneRound(
  userId: string,
  workspaceId: string,
  n: number,
) {
  const { data, error } = await createSecretClient()
    .from("rounds")
    .select(COLUMNS)
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .eq("n", n)
    .eq("status", "done")
    .limit(1)
    .maybeSingle();
  check(error, "get done round");
  return data ? toRound(data) : null;
}

export async function hasActiveRound(userId: string, workspaceId: string) {
  const { data, error } = await createSecretClient()
    .from("rounds")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .in("status", ["queued", "running"])
    .limit(1)
    .maybeSingle();
  check(error, "check active round");
  return data !== null;
}

export async function countRoundsRunningSince(userId: string, since: Date) {
  const { count, error } = await createSecretClient()
    .from("rounds")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("running_at", since.toISOString());
  check(error, "count rounds");
  return count ?? 0;
}

export type RoundStart =
  | { kind: "started"; roundId: string }
  | { kind: "stale" }
  | { kind: "conflict" };

const UNIQUE_VIOLATION = "23505";

// One transaction (see the rounds migration): the round row and the workspace's move to its rounds phase. `stale` means the workspace changed since the confirmed values were saved; `conflict` means another attempt of this round, or another active round, already exists.
export async function startRoundRow(
  userId: string,
  workspaceId: string,
  input: {
    updatedAt: string;
    n: number;
    attempt: number;
    briefVersion: number;
    inputs: NonNullable<Json>;
    now: Date;
  },
): Promise<RoundStart> {
  const { data, error } = await createSecretClient().rpc("start_round", {
    p_user_id: userId,
    p_workspace_id: workspaceId,
    p_updated_at: input.updatedAt,
    p_n: input.n,
    p_attempt: input.attempt,
    p_brief_version: input.briefVersion,
    p_inputs: input.inputs,
    p_now: input.now.toISOString(),
  });
  if (error?.code === UNIQUE_VIOLATION) return { kind: "conflict" };
  check(error, "start round");
  return data ? { kind: "started", roundId: data } : { kind: "stale" };
}

// The queued-to-running claim: whoever flips it owns the run. Returns the round, or null when it wasn't queued any more.
export async function claimRound(userId: string, id: string, now: Date) {
  const { data, error } = await createSecretClient()
    .from("rounds")
    .update({ status: "running", running_at: now.toISOString() })
    .eq("id", id)
    .eq("user_id", userId)
    .eq("status", "queued")
    .select(COLUMNS)
    .maybeSingle();
  check(error, "claim round");
  return data ? toRound(data) : null;
}

// The writes below apply only while the round is running, and say whether they did. `when` narrows them further.
async function updateWhileRunning(
  userId: string,
  id: string,
  values: {
    stage?: string;
    progress?: NonNullable<Json>;
    deadline_at?: string;
    brief_version?: number;
  },
  when: { noDeadline?: boolean; briefVersion?: number } = {},
) {
  let query = createSecretClient()
    .from("rounds")
    .update(values)
    .eq("id", id)
    .eq("user_id", userId)
    .eq("status", "running");
  if (when.noDeadline) query = query.is("deadline_at", null);
  if (when.briefVersion !== undefined) {
    query = query.eq("brief_version", when.briefVersion);
  }
  const { data, error } = await query.select("id");
  check(error, "update round");
  return (data?.length ?? 0) > 0;
}

export function writeRoundProgress(
  userId: string,
  id: string,
  input: { stage: string; progress: NonNullable<Json> },
) {
  return updateWhileRunning(userId, id, input);
}

export function setRoundDeadline(userId: string, id: string, at: Date) {
  return updateWhileRunning(
    userId,
    id,
    { deadline_at: at.toISOString() },
    { noDeadline: true },
  );
}

export function setRoundBriefVersion(
  userId: string,
  id: string,
  from: number,
  to: number,
) {
  return updateWhileRunning(
    userId,
    id,
    { brief_version: to },
    { briefVersion: from },
  );
}

// A queued round whose workflow could not be started; it never ran, so it doesn't count toward the daily limit.
export async function failQueuedRound(userId: string, id: string, now: Date) {
  const { error } = await createSecretClient()
    .from("rounds")
    .update({
      status: "failed",
      error: "workflow_start",
      finished_at: now.toISOString(),
    })
    .eq("id", id)
    .eq("user_id", userId)
    .eq("status", "queued");
  check(error, "fail queued round");
}

export type NewCreative = {
  n: number;
  angle: string;
  photo_id: string;
  background: Json;
  supporting_element: string | null;
  copy: Json;
  layout: Json;
  background_path: string | null;
  preview_path: string;
  judge: Json;
};

// The finish_round function doesn't take the judge column, so the finishing step writes it after the round's files are cleaned; a repeat writes the same records.
export async function writeJudgeRecords(
  userId: string,
  roundId: string,
  creatives: NewCreative[],
) {
  const client = createSecretClient();
  const results = await Promise.all(
    creatives.map((creative) =>
      client
        .from("creatives")
        .update({ judge: creative.judge })
        .eq("round_id", roundId)
        .eq("user_id", userId)
        .eq("n", creative.n),
    ),
  );
  for (const { error } of results) check(error, "write judge records");
}

// See the rounds migration: only a running round changes, and the status after the call comes back, so a repeat is harmless.
export async function finishRound(
  userId: string,
  id: string,
  input: {
    status: "done" | "no_pass" | "failed" | "timed_out";
    error?: string;
    creatives: NewCreative[];
    now: Date;
  },
) {
  const { data, error } = await createSecretClient().rpc("finish_round", {
    p_user_id: userId,
    p_round_id: id,
    p_status: input.status,
    p_error: input.error ?? "",
    p_creatives: input.creatives,
    p_now: input.now.toISOString(),
  });
  check(error, "finish round");
  return z.enum(ROUND_STATUSES).parse(data);
}

// Returns the ids of the rounds it ended; the caller removes their files.
export async function housekeepRounds(
  userId: string,
  input: { staleQueuedS: number; rewriteS: number; now: Date },
) {
  const { data, error } = await createSecretClient().rpc("housekeep_rounds", {
    p_user_id: userId,
    p_stale_queued_s: input.staleQueuedS,
    p_rewrite_s: input.rewriteS,
    p_now: input.now.toISOString(),
  });
  check(error, "housekeep rounds");
  return z.array(z.string()).parse(data);
}
