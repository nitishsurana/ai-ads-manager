import { SnapshotError } from "@/lib/providers/snapshot";
import { isAbandoned } from "../workflow/errors";

// Errors that must end the stage rather than cost one candidate: replay errors are programming errors, and an abandoned round has nothing left to write to.
export const isFatal = (error: unknown) =>
  error instanceof SnapshotError || isAbandoned(error);
