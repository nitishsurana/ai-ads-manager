import "server-only";
import { z } from "zod";
import type { Database, Json } from "../database.types";
import { createSecretClient } from "../secret";
import { check } from "./error";

export type NewPhoto = Omit<
  Database["public"]["Tables"]["photos"]["Insert"],
  "id" | "intake_id" | "workspace_id" | "created_at"
>;

export type CompletedIntake = {
  product_key: string;
  source_url: string;
  product: NonNullable<Json>;
  brand_kit_scraped: NonNullable<Json>;
  brand_kit: NonNullable<Json>;
  logo: Json;
};

const resultSchema = z.object({
  workspaceId: z.string().nullable(),
  adopted: z.boolean(),
});

// One transaction (see the complete_intake migration): workspace, photos, thread pointer, summary message and the intake's done status all happen or none do. workspaceId is null when the intake had already failed.
export async function completeIntakeWithWorkspace(
  userId: string,
  intakeId: string,
  input: {
    workspace: CompletedIntake;
    photos: NewPhoto[];
    summary: { ui_id: string; parts: NonNullable<Json> };
  },
) {
  const { data, error } = await createSecretClient().rpc("complete_intake", {
    p_user_id: userId,
    p_intake_id: intakeId,
    p_workspace: input.workspace,
    p_photos: input.photos,
    p_summary: input.summary,
  });
  check(error, "complete intake");
  return resultSchema.parse(data);
}
