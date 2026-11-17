import "server-only";
import { writeRoundProgress } from "@/lib/db/queries";
import { PROGRESS_WRITE_INTERVAL_MS } from "@/lib/config";
import type { ProgressEvent } from "../stages";
import {
  STAGES,
  type Candidate,
  type RoundProgress,
  type Stage,
} from "../types";
import { RoundAbandonedError, isAbandoned } from "./errors";
import type { RoundRun } from "./types";

type State = {
  stage: Stage;
  done: number;
  total: number;
  candidates: RoundProgress["candidates"];
};

// Stages before the current one are complete and later ones haven't started.
function counts({ stage, done, total, candidates }: State) {
  const current = STAGES.indexOf(stage);
  return Object.fromEntries(
    STAGES.map((name, index) => [
      name,
      index === current
        ? { done, total }
        : {
            done: index < current ? candidates.length : 0,
            total: candidates.length,
          },
    ]),
  );
}

const planned = (candidates: Candidate[]) =>
  candidates.map(({ index, angle }) => ({ n: index + 1, angle }));

// Throttled, serialised writes of rounds.stage and rounds.progress. A write that finds the round no longer running throws RoundAbandonedError, which stops the stage; other write failures are logged and swallowed, since progress is best effort.
export function createProgressWriter(
  run: RoundRun,
  initial: { stage: Stage; candidates: Candidate[] },
) {
  let state: State = {
    stage: initial.stage,
    done: 0,
    total: initial.candidates.length,
    candidates: planned(initial.candidates),
  };
  let lastWrite = 0;
  let gone = false;
  let queue: Promise<unknown> = Promise.resolve();

  async function write() {
    lastWrite = Date.now();
    const snapshot = state;
    const result = queue.then(async () => {
      const running = await writeRoundProgress(run.userId, run.roundId, {
        stage: snapshot.stage,
        progress: { candidates: snapshot.candidates, counts: counts(snapshot) },
      });
      if (!running) {
        gone = true;
        throw new RoundAbandonedError(run.roundId);
      }
    });
    queue = result.catch(() => undefined);
    try {
      await result;
    } catch (error) {
      if (isAbandoned(error)) throw error;
      console.error(`round ${run.roundId}: progress write failed`, error);
    }
  }

  return {
    async onProgress(event: ProgressEvent) {
      if (event.kind === "planned") {
        state = {
          ...state,
          total: event.candidates.length,
          candidates: planned(event.candidates),
        };
        await write();
        return;
      }
      state = { ...state, done: event.done, total: event.total };
      if (
        event.done === event.total ||
        Date.now() - lastWrite >= PROGRESS_WRITE_INTERVAL_MS
      ) {
        await write();
      }
    },
    isAbandoned: () => gone,
    flush: write,
  };
}
