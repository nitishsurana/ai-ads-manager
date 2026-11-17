import { writeFileSync } from "node:fs";
import { analyze } from "./calibrate/analyze";
import { formatReport } from "./calibrate/format";
import { selfTest } from "./calibrate/self-test";

// Read-only: compares the judges and the panel with human ratings in the dev database. Run through `npm run calibrate`.
const args = process.argv.slice(2);

if (args.includes("--self-test")) {
  process.exit(selfTest() ? 0 : 1);
}

const jsonAt = args.indexOf("--json");
const jsonPath = jsonAt === -1 ? null : args[jsonAt + 1];
if (jsonAt !== -1 && (!jsonPath || jsonPath.startsWith("--"))) {
  console.error(
    "Usage: npm run calibrate -- [--include-golden] [--json <path>] (--include-golden calibrates on the golden set)",
  );
  process.exit(1);
}

async function main() {
  process.loadEnvFile(".env.local");
  const { loadSamples } = await import("./calibrate/load");
  const { samples, skipped } = await loadSamples(
    args.includes("--include-golden"),
  );
  const analysis = analyze(samples, skipped);
  console.log(formatReport(analysis));
  if (jsonPath)
    writeFileSync(jsonPath, `${JSON.stringify(analysis, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
