import { JUDGE_MAX_SHOWN, MAX_REGENERATIONS } from "@/lib/config";
import { mapLimit } from "@/lib/intake";
import {
  checkCandidate,
  COVERS_PRODUCT,
  CUT_OFF,
  type CheckContext,
} from "../checks";
import { judgePanel } from "../judge";
import { ANGLE_ELEMENT, badgeOffers, elementsOn } from "../plan";
import { select, type Contender } from "../select";
import type { Candidate, RoundContext, SupportingElement } from "../types";
import { createBuilder } from "./build";
import { isFatal } from "./errors";
import type { StageDeps } from "./types";

const CONCURRENCY = 3;
const DETERMINISTIC = [COVERS_PRODUCT, CUT_OFF];

const contender = ({ index, angle, supportingElement, judge }: Candidate) =>
  ({
    index,
    angle,
    element: supportingElement,
    rank: judge?.rank ?? Infinity,
    pass: judge?.pass ?? false,
  }) satisfies Contender;

// Layer 1, the judge panel and selection. Returns the creatives to show, best first, each with its judge record.
export async function checkAndSelect(
  input: RoundContext,
  candidates: Candidate[],
  deps: StageDeps,
): Promise<Candidate[]> {
  const { inputs, roundId } = input;
  const brief = await deps.brief();
  const builder = createBuilder(input, deps);
  const { fonts, logo } = await builder.assets();
  const ctx: CheckContext = {
    input,
    fonts,
    logo,
    deps,
    prepared: builder.prepared,
  };
  const timeLeft = () => Date.now() < deps.regenerateUntil;
  const report = (done: number) =>
    deps.progress({
      kind: "stage",
      stage: "checking_quality",
      done,
      total: candidates.length,
    });

  async function redo(candidate: Candidate, regeneration: number) {
    try {
      return await builder.compose(
        await builder.background(candidate, regeneration),
      );
    } catch (error) {
      if (isFatal(error)) throw error;
      console.warn(
        `round ${roundId}: candidate ${candidate.index} regeneration ${regeneration} failed`,
        error,
      );
      return {
        ...candidate,
        backgroundPath: null,
        product: null,
        layout: null,
        previewPath: null,
      };
    }
  }

  // Counted so a round where nothing could be drawn at all fails instead of reading as "nothing passed".
  let verdicts = 0;
  let settled = 0;

  async function layerOne(candidate: Candidate): Promise<Candidate | null> {
    let current = candidate;
    for (let regeneration = 0; ; regeneration++) {
      let problems = ["render: the candidate could not be drawn"];
      if (current.previewPath) {
        try {
          problems = await checkCandidate(current, ctx);
        } catch (error) {
          if (isFatal(error)) throw error;
          console.warn(
            `round ${roundId}: candidate ${candidate.index} could not be checked`,
            error,
          );
          return null;
        }
        verdicts++;
        if (problems.length === 0) return current;
      }
      console.warn(
        `round ${roundId}: candidate ${candidate.index} failed Layer 1 (regeneration ${regeneration}): ${problems.join("; ")}`,
      );
      // Only a generated image changes with the seed (a Bria scene, a placed photo's bands), and placement is deterministic, so a paid redo can't fix a product that is covered or cut off.
      const { background } = current;
      const generated =
        background.method === "bria" ||
        (background.method === "photo" && background.gaps === true);
      const redoable =
        !current.previewPath ||
        (generated && problems.some((p) => !DETERMINISTIC.includes(p)));
      if (regeneration >= MAX_REGENERATIONS || !timeLeft() || !redoable) {
        return null;
      }
      current = await redo(current, regeneration + 1);
    }
  }

  const survivors = (
    await mapLimit(candidates, CONCURRENCY, async (candidate) => {
      const kept = await layerOne(candidate);
      await report(++settled);
      return kept;
    })
  ).filter((candidate) => candidate !== null);
  if (survivors.length === 0) {
    if (verdicts === 0) throw new Error("no candidate could be drawn");
    return [];
  }

  async function judge(list: Candidate[]) {
    const entries = await Promise.all(
      list.map(async (candidate) => {
        const preview = await deps.storage.get(
          "previews",
          candidate.previewPath ?? "",
        );
        if (!preview)
          throw new Error(`storage: preview ${candidate.index} is missing`);
        return { candidate, preview };
      }),
    );
    const records = await judgePanel(input, entries, brief, deps);
    return list.map((candidate, i) => ({
      ...candidate,
      judge: records[i] ?? null,
    }));
  }

  // When three pass but their badges miss an element, a lower-ranked candidate (one that passed the judges first) takes the badge: only its text layer is drawn again, then it is checked and judged like the rest.
  async function covering(
    judged: Candidate[],
    missing: SupportingElement[],
    shown: number[],
  ) {
    const donors = judged
      .filter((c) => !shown.includes(c.index) && !ANGLE_ELEMENT[c.angle])
      .sort(
        (a, b) =>
          Number(b.judge?.pass) - Number(a.judge?.pass) ||
          (a.judge?.rank ?? 0) - (b.judge?.rank ?? 0),
      );
    const changed = new Map<number, Candidate | null>();
    await Promise.all(
      missing.slice(0, donors.length).map(async (element, i) => {
        const donor = donors[i] as Candidate;
        const offer = badgeOffers(inputs)[0];
        try {
          const badged = await builder.compose({
            ...donor,
            supportingElement: element,
            offerFactId: element === "offer" ? (offer?.id ?? null) : null,
            judge: null,
          });
          const problems = await checkCandidate(badged, ctx);
          if (problems.length > 0) {
            console.warn(
              `round ${roundId}: candidate ${donor.index} with a ${element} badge failed Layer 1: ${problems.join("; ")}`,
            );
          }
          changed.set(donor.index, problems.length === 0 ? badged : null);
        } catch (error) {
          if (isFatal(error)) throw error;
          console.warn(
            `round ${roundId}: candidate ${donor.index} could not take a ${element} badge`,
            error,
          );
          changed.set(donor.index, null);
        }
      }),
    );
    if (changed.size === 0) return null;
    return judge(
      judged.flatMap((c) => {
        if (!changed.has(c.index)) return [c];
        const next = changed.get(c.index);
        return next ? [next] : [];
      }),
    );
  }

  let judged = await judge(survivors);
  let selection = select(judged.map(contender), elementsOn(inputs));
  if (selection.missing.length > 0 && timeLeft()) {
    const recovered = await covering(
      judged,
      selection.missing,
      selection.shown,
    );
    // The swap only counts if it leaves fewer elements missing without showing fewer creatives.
    const again =
      recovered && select(recovered.map(contender), elementsOn(inputs));
    if (
      recovered &&
      again &&
      again.missing.length < selection.missing.length &&
      again.shown.length >= selection.shown.length
    ) {
      judged = recovered;
      selection = again;
    }
  }
  await report(candidates.length);
  if (selection.shown.length < JUDGE_MAX_SHOWN && selection.shown.length > 0) {
    console.warn(
      `round ${roundId}: ${selection.shown.length} creatives passed`,
    );
  }
  return selection.shown.flatMap(
    (index) => judged.find((candidate) => candidate.index === index) ?? [],
  );
}
