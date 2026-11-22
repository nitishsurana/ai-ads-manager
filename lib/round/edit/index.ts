import "server-only";
import { randomUUID } from "node:crypto";
import {
  insertRoundCosts,
  hasActiveRound,
  writeCreativeIf,
} from "@/lib/db/queries";
import type { CostEntry } from "@/lib/intake";
import { messages } from "@/lib/messages";
import { spendCapReached } from "@/lib/limits";
import { previewOf, renderCreative, type Layout } from "@/lib/render";
import { checkCandidate } from "../checks";
import { planCreative } from "../compose";
import { contextOf, offlineDeps } from "../context";
import { claimsIn } from "../copy";
import { editProblem, squash } from "../copy/limits";
import { parseCreative, type Edit } from "../creative";
import { ownedCreative } from "../feedback";
import type { RoundResult } from "../result";
import { createBuilder } from "../stages";
import type { Candidate } from "../types";

// "layout: the headline drawn is not the copy" reads as "the headline drawn is not the copy".
const reasonOf = (problem: string) => problem.replace(/^[a-z ]+:\s*/, "");

type EditInput = {
  creativeId: string;
  rev: number;
  headline: string;
  cta: string;
};

// Nothing is written until the edit passes the limits, the copy-truth check and Layer 1 on a re-planned layout; the one compare-and-swap write then swaps in the new preview.
export async function editCreative(
  userId: string,
  workspaceId: string,
  input: EditInput,
): Promise<RoundResult<{ rev: number }>> {
  const owned = await ownedCreative(userId, workspaceId, input.creativeId);
  if (!owned) return { ok: false, code: "not_found" };
  if (await hasActiveRound(userId, workspaceId)) {
    return { ok: false, code: "round_running" };
  }
  const { round } = owned;
  const creative = parseCreative(owned.creative);
  if (input.rev !== creative.rev)
    return { ok: false, code: "creative_changed" };
  const headline = squash(input.headline);
  const cta = squash(input.cta);

  const limit = editProblem({
    headline,
    cta,
    eyebrow: creative.copy.eyebrow,
  });
  if (limit) return { ok: false, code: limit };
  const context = contextOf(userId, round);
  const claims = claimsIn(`${headline}\n${cta}`, context.inputs);
  if (claims.length > 0) {
    return {
      ok: false,
      code: "edit_rejected",
      reason: `"${claims.join(" ")}" ${messages.edit_claim}`,
    };
  }
  if (headline === creative.copy.headline && cta === creative.copy.cta) {
    return { ok: true, rev: creative.rev };
  }
  if (await spendCapReached()) return { ok: false, code: "spend_cap" };

  const { backgroundPath, photoId } = creative;
  if (!backgroundPath || !photoId) {
    throw new Error(`creative ${creative.id}: nothing to draw the edit from`);
  }
  const { inputs } = context;
  const costs: CostEntry[] = [];
  const deps = offlineDeps(context, costs);
  const label = `creative ${creative.id}`;
  const newPath = `${round.id}/n${creative.n}-${randomUUID()}.jpg`;

  try {
    const background = await deps.storage.get("backgrounds", backgroundPath);
    if (!background) throw new Error(`${label}: the stored background is gone`);
    const builder = createBuilder(context, deps);
    const { fonts, logo } = await builder.assets();
    const copy = { ...creative.copy, headline, cta };
    const candidate: Candidate = {
      index: creative.n - 1,
      angle: creative.angle,
      photoId,
      supportingElement: creative.supportingElement,
      offerFactId: creative.layout.offerFactId,
      background: creative.background,
      copy,
      ctaColour: creative.layout.cta.mode,
      backgroundPath,
      product: creative.layout.product,
      layout: null,
      previewPath: creative.previewPath,
      judge: null,
    };
    const layout = await planCreative(candidate, background, {
      inputs,
      fonts,
      logo,
      label,
      keepClear: creative.layout.keepClear,
      logoGeometry: creative.layout.logoGeometry ?? 1,
      badgeRule: creative.layout.badgeRule ?? 1,
      logoRule: creative.layout.logoRule ?? 1,
      ctaPreferred: creative.layout.cta.background,
    });

    const lost = lostElement(creative.layout, layout);
    if (lost) {
      return {
        ok: false,
        code: "edit_rejected",
        reason: `the ${lost} ${messages.edit_lost_element}`,
      };
    }

    const problems = await checkCandidate(
      { ...candidate, layout },
      { input: context, fonts, logo, deps, prepared: builder.prepared },
    );
    const [problem] = problems;
    if (problem) {
      console.warn(`${label}: edit refused: ${problems.join("; ")}`);
      return { ok: false, code: "edit_rejected", reason: reasonOf(problem) };
    }

    const { png } = await renderCreative({
      background,
      layout,
      fonts,
      logo: logo?.png ?? null,
    });
    await deps.storage.put(
      "previews",
      newPath,
      await previewOf(png),
      "image/jpeg",
    );
    const edit: Edit = {
      at: new Date().toISOString(),
      from: { headline: creative.copy.headline, cta: creative.copy.cta },
      to: { headline, cta },
    };
    const rev = await writeCreativeIf(userId, creative.id, creative.rev, {
      copy,
      layout,
      preview_path: newPath,
      edits: [...creative.edits, edit],
    });
    if (rev === null) {
      await removePreview(deps.storage, newPath, label);
      return { ok: false, code: "creative_changed" };
    }
    await removePreview(deps.storage, creative.previewPath, label);
    return { ok: true, rev };
  } catch (error) {
    await removePreview(deps.storage, newPath, label);
    throw error;
  } finally {
    // The edit is saved or refused by now; a lost cost row is logged, not reported as a failed edit.
    try {
      await insertRoundCosts(
        userId,
        round.id,
        workspaceId,
        costs.map((cost) => ({
          provider: cost.provider,
          model: cost.model,
          usd: cost.usd,
          meta: { task: cost.task ?? "edit" },
        })),
      );
    } catch (error) {
      console.error(`${label}: recording edit costs failed`, error);
    }
  }
}

// An element the stored layout drew that the new one can't (the logo falling back out, a badge that no longer fits).
function lostElement(stored: Layout, next: Layout) {
  return (["eyebrow", "badge", "logo"] as const).find(
    (element) => stored[element] && !next[element],
  );
}

async function removePreview(
  storage: { remove(bucket: string, paths: string[]): Promise<void> },
  path: string,
  label: string,
) {
  try {
    await storage.remove("previews", [path]);
  } catch (error) {
    console.error(`${label}: removing ${path} failed`, error);
  }
}
