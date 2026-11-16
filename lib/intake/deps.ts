import { createAi } from "@/lib/providers/ai";
import { createDns } from "@/lib/providers/dns";
import { createFal } from "@/lib/providers/fal";
import { createFirecrawl } from "@/lib/providers/firecrawl";
import { createHttp } from "@/lib/providers/http";
import type { IntakeDeps } from "./types";

export function createIntakeDeps(options: {
  findWorkspace: IntakeDeps["findWorkspace"];
  storage: IntakeDeps["storage"];
  progress?: IntakeDeps["progress"];
  snapshotDir?: string;
}): IntakeDeps {
  const { snapshotDir } = options;
  const dns = createDns({ snapshotDir });
  const http = createHttp({ dns, snapshotDir });
  return {
    http,
    firecrawl: createFirecrawl({ snapshotDir }),
    ai: createAi({ snapshotDir }),
    fal: createFal({ http, snapshotDir }),
    storage: options.storage,
    progress: options.progress ?? (() => {}),
    findWorkspace: options.findWorkspace,
  };
}
