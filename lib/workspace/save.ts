import "server-only";
import { isDeepStrictEqual } from "node:util";
import {
  applyAnswers,
  canGenerate,
  type Answers,
  type ConfirmState,
} from "@/lib/confirm";
import { setPhotosSelected, updateWorkspaceIf } from "@/lib/db/queries";
import { retryOnMiss } from "./cas";
import { loadWorkspaceState } from "./load";
import type { Failure, Result } from "./result";
import { isLocked } from "./rounds";
import { toStored } from "./state";

// What was written: Phase 6's round start uses this state and stamp, not a re-read of the row.
type Saved = { ok: true; state: ConfirmState; updatedAt: string };

// The tester's ticks are written as given, not as a difference from what was loaded; a deselect beats a select, as in applyAnswers.
async function persistPhotos(
  userId: string,
  workspaceId: string,
  answers: Answers,
) {
  await setPhotosSelected(userId, workspaceId, answers.select ?? [], true);
  await setPhotosSelected(userId, workspaceId, answers.deselect ?? [], false);
}

// Load, change, write only if nobody wrote in between (up to 3 tries). `change` returns null to refuse. The answers and the brand kit go to their columns in one write; photo selection follows.
async function saveWith(
  userId: string,
  workspaceId: string,
  change: (state: ConfirmState) => ConfirmState | null,
  answers: Answers = {},
): Promise<Saved | Failure> {
  const saved = await retryOnMiss<Saved | Failure>(async () => {
    const loaded = await loadWorkspaceState(userId, workspaceId);
    if (!loaded) return { ok: false, code: "not_found" };
    if (await isLocked(userId, loaded.workspace)) {
      return { ok: false, code: "confirm_locked" };
    }
    const before = loaded.state;
    const after = change(before);
    if (!after) return { ok: false, code: "cannot_generate" };
    const written = await updateWorkspaceIf(
      userId,
      workspaceId,
      loaded.workspace.updatedAt,
      {
        confirmed: toStored(after),
        ...(isDeepStrictEqual(before.brandKit, after.brandKit)
          ? {}
          : { brand_kit: after.brandKit }),
      },
    );
    if (!written) return null;
    await persistPhotos(userId, workspaceId, answers);
    return { ok: true, state: after, updatedAt: written };
  });
  if (!saved) {
    console.error(`workspace ${workspaceId}: save lost the race 3 times`);
    return { ok: false, code: "save_failed" };
  }
  return saved;
}

export async function saveAnswers(
  userId: string,
  workspaceId: string,
  answers: Answers,
): Promise<Result> {
  const saved = await saveWith(
    userId,
    workspaceId,
    (state) => applyAnswers(state, answers),
    answers,
  );
  return saved.ok ? { ok: true } : saved;
}

// Both buttons of the bottom bar come here: the saved answers must pass canGenerate, and `confirmed` is written even when the tester changed nothing. Phase 6 starts a round only through this, never on the strength of the phase.
export function commitConfirmed(userId: string, workspaceId: string) {
  return saveWith(userId, workspaceId, (state) =>
    canGenerate(state) ? state : null,
  );
}
