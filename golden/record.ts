import { join } from "node:path";
import { runIntake } from "@/lib/intake";
import { createRealFirecrawl } from "@/lib/providers/firecrawl";
import { createRealDns } from "@/lib/providers/dns";
import { createRealHttp } from "@/lib/providers/http";
import { readCsv } from "./csv";
import { createRecorder } from "./recorder";

process.loadEnvFile(".env.local");

const ids = process.argv.slice(2);
if (ids.length === 0) {
  console.error("Usage: tsx golden/record.ts <ID> [<ID>...]");
  process.exit(1);
}

async function main() {
  const rows = readCsv("golden-set-expected-behaviour.csv");

  for (const id of ids) {
    const url = rows.find((r) => r.ID === id)?.["Product URL"];
    if (!url) {
      console.error(`${id}: no such row`);
      process.exitCode = 1;
      continue;
    }

    const recorder = createRecorder(join(".golden", id));
    const dns = recorder.dns(createRealDns());
    const http = recorder.http(createRealHttp({ dns }));
    const outcome = await runIntake(
      { url },
      {
        http,
        firecrawl: recorder.firecrawl(createRealFirecrawl()),
        findWorkspace: async () => null,
      },
    );

    const market = "result" in outcome ? outcome.result.market : "US";
    recorder.save({ url, location: market });
    const summary = outcome.ok ? "ok" : outcome.code;
    console.log(`${id}: recorded (${summary})`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
