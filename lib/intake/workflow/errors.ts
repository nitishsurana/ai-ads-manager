// The intake is no longer reading: another path claimed it as failed and owns its cleanup. The stage stops and only removes what it wrote since.
export class IntakeAbandonedError extends Error {
  constructor(intakeId: string) {
    super(`intake ${intakeId} is no longer reading`);
  }
}

export function isAbandoned(error: unknown) {
  return (
    error instanceof IntakeAbandonedError ||
    (error instanceof Error && error.cause instanceof IntakeAbandonedError)
  );
}

// The thread can't take a new intake: it has a workspace, or an intake is already reading.
export class IntakeConflictError extends Error {}
