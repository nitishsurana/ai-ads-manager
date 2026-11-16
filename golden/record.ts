import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runIntake } from "@/lib/intake";
import { marketOf } from "@/lib/intake/product-key";
import { createRealAi } from "@/lib/providers/ai";
import { createRealFal } from "@/lib/providers/fal";
import { createRealFirecrawl } from "@/lib/providers/firecrawl";
import { createRealDns } from "@/lib/providers/dns";
import { createRealHttp } from "@/lib/providers/http";
import { createLocalStorage } from "@/lib/providers/storage";
import { readCsv } from "./csv";
import { createRecorder } from "./recorder";

process.loadEnvFile(".env.local");

const ids = process.argv.slice(2);
if (ids.length === 0) {
  console.error("Usage: tsx golden/record.ts <ID> [<ID>...]");
  process.exit(1);
}

async function main() {
  const storage = createLocalStorage(
    mkdtempSync(join(tmpdir(), "golden-record-")),
  );
  const rows = readCsv("golden-set-expected-behaviour.csv");

  for (const id of ids) {
    const url = rows.find((r) => r.ID === id)?.["Product URL"];
    if (!url) {
      console.error(`${id}: no such row`);
      process.exitCode = 1;
      continue;
    }

    const recorder = createRecorder(join(".golden", id));
    const realDns = createRealDns();
    const dns = recorder.dns(realDns);
    const http = recorder.http(createRealHttp({ dns }));
    let outcome;
    try {
      outcome = await runIntake(
        { url, intakeId: id },
        {
          http,
          firecrawl: recorder.firecrawl(createRealFirecrawl()),
          ai: recorder.ai(createRealAi()),
          fal: recorder.fal(
            createRealFal({ http: createRealHttp({ dns: realDns }) }),
          ),
          storage,
          progress: () => {},
          findWorkspace: async () => null,
        },
      );
    } catch (error) {
      // Keep the answers already paid for; the failed call itself was never recorded.
      recorder.save({ url, location: marketOf(new URL(url)) });
      console.error(`${id}: failed, partial recording saved`);
      throw error;
    }

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
