import { createDns } from "@/lib/providers/dns";
import { createFirecrawl } from "@/lib/providers/firecrawl";
import { createHttp } from "@/lib/providers/http";
import type { IntakeDeps } from "./types";

export function createIntakeDeps(options: {
  findWorkspace: IntakeDeps["findWorkspace"];
  snapshotDir?: string;
}): IntakeDeps {
  const dns = createDns({ snapshotDir: options.snapshotDir });
  const http = createHttp({ dns, snapshotDir: options.snapshotDir });
  const firecrawl = createFirecrawl({ snapshotDir: options.snapshotDir });
  return { http, firecrawl, findWorkspace: options.findWorkspace };
}
