import type { SupabaseClient } from "@supabase/supabase-js";
import type { Storage } from "./types";

const MAX_PASSES = 20;

export function createSupabaseStorage(client: SupabaseClient): Storage {
  return {
    async put(bucket, path, bytes, contentType) {
      const { error } = await client.storage
        .from(bucket)
        .upload(path, bytes, { contentType, upsert: true });
      if (error)
        throw new Error(`storage: put ${bucket}/${path}: ${error.message}`);
    },
    async remove(bucket, paths) {
      const { error } = await client.storage.from(bucket).remove(paths);
      if (error)
        throw new Error(`storage: remove from ${bucket}: ${error.message}`);
    },
    async removePrefix(bucket, prefix) {
      const files = client.storage.from(bucket);
      // Each pass removes what it lists; stop when nothing is listed or removed, and never loop forever.
      for (let pass = 0; pass < MAX_PASSES; pass++) {
        const { data, error } = await files.list(prefix, { limit: 100 });
        if (error)
          throw new Error(
            `storage: list ${bucket}/${prefix}: ${error.message}`,
          );
        if (data.length === 0) return;
        const { data: removed, error: removeError } = await files.remove(
          data.map((file) => `${prefix}/${file.name}`),
        );
        if (removeError)
          throw new Error(
            `storage: remove from ${bucket}/${prefix}: ${removeError.message}`,
          );
        if (removed.length === 0) return;
      }
      console.error(
        `storage: ${bucket}/${prefix} still has files after ${MAX_PASSES} passes`,
      );
    },
  };
}
