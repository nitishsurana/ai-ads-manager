// The round is no longer running: another path ended it (the deadline or the stuck rules) and owns its cleanup. The stage stops and only removes what it wrote since.
export class RoundAbandonedError extends Error {
  constructor(roundId: string) {
    super(`round ${roundId} is no longer running`);
  }
}

export function isAbandoned(error: unknown) {
  return (
    error instanceof RoundAbandonedError ||
    (error instanceof Error && error.cause instanceof RoundAbandonedError)
  );
}
