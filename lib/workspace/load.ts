import "server-only";
import { getWorkspace, listFacts, listWorkspacePhotos } from "@/lib/db/queries";
import { parseCampaign } from "@/lib/chat/campaign";
import { isLocked } from "./rounds";
import { buildConfirmState } from "./state";
import { signUrls } from "./urls";

// The persisted answers of an owned workspace; null for anything else. Saving, generating and the rounds all read the state through here.
export async function loadWorkspaceState(userId: string, id: string) {
  const workspace = await getWorkspace(userId, id);
  if (!workspace) return null;
  const photos = await listWorkspacePhotos(userId, id);
  return { workspace, photos, ...buildConfirmState(workspace, photos) };
}

// Everything the confirm screen renders. Photo and logo URLs are signed for a few minutes.
export async function loadConfirmScreen(userId: string, id: string) {
  const loaded = await loadWorkspaceState(userId, id);
  if (!loaded) return null;
  const { workspace, state, photos, variants, title } = loaded;

  const [facts, thumbs, logos, locked] = await Promise.all([
    listFacts(userId, workspace.threadId),
    signUrls(
      "photos",
      photos.map((photo) => photo.thumbPath),
    ),
    signUrls("logos", state.logo?.pngPath ? [state.logo.pngPath] : []),
    isLocked(userId, workspace),
  ]);

  return {
    id: workspace.id,
    phase: workspace.phase,
    sourceUrl: workspace.sourceUrl,
    title,
    state,
    photoViews: photos.map((photo) => ({
      position: photo.position,
      url: thumbs.get(photo.thumbPath) ?? null,
      background: photo.background,
    })),
    variantTitles: Object.fromEntries(variants.map((v) => [v.id, v.title])),
    logoUrl: state.logo?.pngPath
      ? (logos.get(state.logo.pngPath) ?? null)
      : null,
    campaign: parseCampaign(workspace.campaign),
    facts,
    locked,
  };
}

export type ConfirmScreenData = NonNullable<
  Awaited<ReturnType<typeof loadConfirmScreen>>
>;
