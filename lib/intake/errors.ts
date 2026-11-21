import type { Step1FailureCode } from "@/lib/messages";

// A stage failure that knows which message the tester should see.
export class IntakeStageError extends Error {
  constructor(
    readonly code: Step1FailureCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

export function failureCodeOf(error: unknown): Step1FailureCode | null {
  for (let e = error; e instanceof Error; e = e.cause) {
    if (e instanceof IntakeStageError) return e.code;
  }
  return null;
}
