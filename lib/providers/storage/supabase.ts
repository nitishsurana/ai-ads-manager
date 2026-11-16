import type { SupabaseClient } from "@supabase/supabase-js";
import type { Storage } from "./types";

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
  };
}
