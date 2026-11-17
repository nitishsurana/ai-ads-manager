// Writes the committed brand fixtures under golden/fixtures/brand-*. The pages, images and Storefront answers are hand-written; the model answers are scripted per fixture and recorded through the real pipeline, so each fixture replays exactly what the code asks.
// Run: npx tsx golden/brand-fixtures/index.ts
import { logoSpecs } from "./specs-logo";
import { nameSpecs } from "./specs-name";
import { sourceSpecs } from "./specs-source";
import { styleSpecs } from "./specs-style";
import { writeAll } from "./write";

process.env.PROVIDERS = "fake";

async function main() {
  await writeAll([
    ...(await logoSpecs()),
    ...(await sourceSpecs()),
    ...(await nameSpecs()),
    ...styleSpecs(),
  ]);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
