import "server-only";
import { getCreative, getRound } from "@/lib/db/queries";
import { createSecretClient } from "@/lib/db/secret";
import { loadFonts, renderCreative } from "@/lib/render";
import { contextOf, offlineDeps } from "../context";
import { parseCreative } from "../creative";
import { creativeFileName } from "../file-name";
import type { RoundResult } from "../result";

const BUCKET = "exports";
const URL_TTL_S = 5 * 60;

// The store part of a file name: the confirmed brand name, else the shop's host.
function storeOf(brandName: string | null, sourceUrl: string) {
  if (brandName) return brandName;
  try {
    return (
      new URL(sourceUrl).hostname.replace(/^www\./, "").split(".")[0] ?? null
    );
  } catch {
    return null;
  }
}

// Draws the stored creative at full size (nothing re-planned) into the exports bucket and returns a short-lived signed URL under its file name.
export async function exportCreative(
  userId: string,
  creativeId: string,
): Promise<RoundResult<{ url: string; fileName: string }>> {
  const row = await getCreative(userId, creativeId);
  const round = row && (await getRound(userId, row.roundId));
  if (!row || !round) return { ok: false, code: "not_found" };
  const creative = parseCreative(row);
  const context = contextOf(userId, round);
  const { inputs } = context;
  if (!creative.backgroundPath) {
    throw new Error(`creative ${creative.id}: it has no background to draw`);
  }

  const deps = offlineDeps(context, []);
  const logoPath = inputs.logo?.pngPath;
  const [background, logo, fonts] = await Promise.all([
    deps.storage.get("backgrounds", creative.backgroundPath),
    creative.layout.logo?.kind === "image" && logoPath
      ? deps.storage.get("logos", logoPath)
      : null,
    loadFonts(creative.layout.fonts, deps),
  ]);
  if (!background) {
    throw new Error(`creative ${creative.id}: the stored background is gone`);
  }
  const { png } = await renderCreative({
    background,
    layout: creative.layout,
    fonts,
    logo,
  });

  const fileName = creativeFileName({
    store: storeOf(inputs.values.brandName, inputs.sourceUrl),
    product: inputs.productTitle,
    round: round.n,
    n: creative.n,
    currency:
      creative.layout.badge?.kind === "price" ? inputs.values.currency : null,
  });
  const path = `${userId}/${creative.id}-${creative.rev}.png`;
  await deps.storage.put(BUCKET, path, png, "image/png");
  const { data, error } = await createSecretClient()
    .storage.from(BUCKET)
    .createSignedUrl(path, URL_TTL_S, { download: fileName });
  if (error || !data) {
    await deps.storage.remove(BUCKET, [path]);
    throw new Error(`creative ${creative.id}: signing the export failed`, {
      cause: error,
    });
  }
  return { ok: true, url: data.signedUrl, fileName };
}
