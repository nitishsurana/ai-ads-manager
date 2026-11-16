import { createHash } from "node:crypto";

const HASH_LENGTH = 8;

// The model, prompts and input settings are part of the key, so tuning any of them can't silently replay a stale answer.
export function aiSnapshotKey(request: {
  task: string;
  model: string;
  system: string;
  prompt: string;
  inputVersion?: string;
  inputSha256: string;
}) {
  const settings = [
    request.model,
    request.system,
    request.prompt,
    request.inputVersion ?? "",
  ].join("\n");
  const settingsHash = createHash("sha256")
    .update(settings)
    .digest("hex")
    .slice(0, HASH_LENGTH);
  return `${request.task}:${settingsHash}:${request.inputSha256}`;
}
