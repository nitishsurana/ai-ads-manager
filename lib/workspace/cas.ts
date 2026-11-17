const ATTEMPTS = 3;

// A write that read first and lost the race to another write returns null and is tried again from a fresh read.
export async function retryOnMiss<T>(attempt: () => Promise<T | null>) {
  for (let i = 0; i < ATTEMPTS; i++) {
    const result = await attempt();
    if (result !== null) return result;
  }
  return null;
}
