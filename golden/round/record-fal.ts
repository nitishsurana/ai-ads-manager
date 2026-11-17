import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { z } from "zod";
import {
  createRealFal,
  createReplayFal,
  editSnapshotKey,
  type Fal,
} from "@/lib/providers/fal";
import { createRealDns } from "@/lib/providers/dns";
import { createRealHttp } from "@/lib/providers/http";
import {
  falSnapshotSchema,
  readSnapshotJson,
  sha256,
  SnapshotError,
} from "@/lib/providers/snapshot";

type Log = z.infer<typeof falSnapshotSchema>;

// Live Fal calls for a row's round, saved as <dir>/fal.json and <dir>/bodies/. What is already recorded in the round's folder or step 1's is replayed, so a re-record costs nothing; delete fal.json to refresh.
export function recordingFal(
  roundDir: string,
  rowDir: string,
  maxEdits: number,
) {
  const real = createRealFal({
    http: createRealHttp({ dns: createRealDns() }),
  });
  const known = createReplayFal(roundDir, rowDir);
  const file = join(roundDir, "fal.json");
  const log: Log = existsSync(file)
    ? readSnapshotJson(roundDir, "fal.json", falSnapshotSchema)
    : {};
  const bodies = new Map<string, Buffer>();
  const calls = { masks: 0, edits: 0 };

  const keep = (key: string, body: Buffer) => {
    const ref = `bodies/${sha256(body)}`;
    bodies.set(ref, body);
    log[key] = ref;
  };

  const fal: Fal = {
    async backgroundMask(request) {
      try {
        return await known.backgroundMask(request);
      } catch (error) {
        if (!(error instanceof SnapshotError)) throw error;
      }
      calls.masks++;
      const mask = await real.backgroundMask(request);
      keep(request.inputSha256, mask);
      return mask;
    },
    async backgroundEdit(request) {
      try {
        return await known.backgroundEdit(request);
      } catch (error) {
        if (!(error instanceof SnapshotError)) throw error;
      }
      if (calls.edits >= maxEdits) {
        throw new Error(
          `record: more than ${maxEdits} new Bria edits, stopping`,
        );
      }
      calls.edits++;
      const edited = await real.backgroundEdit(request);
      keep(editSnapshotKey(request.inputSha256), edited);
      return edited;
    },
  };

  return {
    fal,
    calls,
    save() {
      mkdirSync(join(roundDir, "bodies"), { recursive: true });
      writeFileSync(file, `${JSON.stringify(log, null, 2)}\n`);
      for (const [ref, body] of bodies) {
        writeFileSync(join(roundDir, ref), body);
      }
    },
  };
}
