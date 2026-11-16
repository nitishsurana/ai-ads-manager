import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import sharp from "sharp";
import { isDeepStrictEqual } from "node:util";
import { join } from "node:path";
import {
  createIntakeDeps,
  runIntake,
  runIntakeUntilBrand,
  type BrandResult,
  type IntakeOutcome,
  type UntilBrandOutcome,
} from "@/lib/intake";
import { ESCALATION_MODEL } from "@/lib/intake/photos";
import { messages } from "@/lib/messages";
import { firecrawlSnapshotSchema } from "@/lib/providers/snapshot";
import { caseSchema, readSnapshotJson } from "@/lib/providers/snapshot";
import { createLocalStorage } from "@/lib/providers/storage";
import { loadExpectations, type Expectation } from "./expectations";

process.env.PROVIDERS = "fake";

type Outcome = IntakeOutcome | UntilBrandOutcome;

const normalise = (text: string) => text.replace(/[‘’]/g, "'");

// Rows recorded before the brand stage have no homepage page to replay; their expectations carry no brand fields, so they run the stages up to photos only.
function hasBrandPages(dir: string) {
  const file = join(dir, "firecrawl.json");
  if (!existsSync(file)) return false;
  const pages = Object.keys(
    readSnapshotJson(dir, "firecrawl.json", firecrawlSnapshotSchema),
  );
  return pages.some((page) =>
    /^\/([a-z]{2}(-[a-z]{2})?\/)?$/i.test(new URL(page).pathname),
  );
}

function snapshotDirOf(name: string) {
  return [join(".golden", name), join("golden", "fixtures", name)].find((dir) =>
    existsSync(join(dir, "case.json")),
  );
}

function observe(outcome: Outcome): Record<string, unknown> {
  if (!outcome.ok) {
    return { message: `Failure: ${messages[outcome.code]}` };
  }
  if ("existingWorkspaceId" in outcome) {
    return { message: null, existingWorkspaceId: outcome.existingWorkspaceId };
  }
  const { productKey, finalUrl, market, page, photos, warnings } =
    outcome.result;
  const brand = "brand" in outcome.result ? outcome.result.brand : undefined;
  const dropped = photos.photos.filter((photo) => photo.dropped);
  const shown = photos.photos.filter((photo) => photo.selected);
  const warns = (code: string) =>
    shown.some((photo) => photo.warnings.includes(code as never));
  return {
    message: null,
    productKey,
    finalUrl,
    market,
    price: page.price,
    wasPrice: page.wasPrice,
    currency: page.currency,
    purchase: page.purchase,
    needsVariantChoice: page.needsVariantChoice,
    buyableVariants: page.variants.filter((v) => v.availability === "buyable")
      .length,
    rating: page.rating,
    warnings: warnings.map((code) => `Warning: ${messages[code]}`),
    uniquePhotos: photos.photos.length,
    shownPhotos: shown.length,
    droppedPositions: dropped.map((photo) => photo.position),
    dropReasons: Object.fromEntries(
      dropped.map((photo) => [photo.position, photo.dropReason]),
    ),
    duplicatePositions: photos.duplicates.map((d) => d.position),
    skippedPositions: photos.skipped.map((s) => s.position),
    escalatedPositions: photos.photos
      .filter((photo) => photo.checks.model === ESCALATION_MODEL)
      .map((photo) => photo.position),
    lowResWarning: warns("low_resolution"),
    textWarning: warns("photo_text"),
    ...observeBrand(brand),
  };
}

function observeBrand(brand: BrandResult | undefined) {
  if (!brand) return {};
  const { logo, brandKit, brandKitScraped } = brand;
  return {
    brandPages: brand.pages,
    logoSource: logo?.source ?? null,
    logoColourClass: logo?.colourClass ?? null,
    logoTransparent: logo?.transparent ?? null,
    logoColours: logo?.colours ?? [],
    logoSize: logo?.width && logo.height ? [logo.width, logo.height] : null,
    headerBackground: logo?.headerBackground ?? null,
    storeName: brand.storeName,
    needsBrandName: brand.needsBrandName,
    headingFont: brandKit.fonts.heading.family,
    paletteBackground: brandKit.palette.background,
    kitReady:
      brandKit !== brandKitScraped &&
      isDeepStrictEqual(brandKit, brandKitScraped) &&
      brandKit.tone.length === 3 &&
      brandKit.valuePropositions.length === 3,
  };
}

const comparable = (value: unknown): unknown => {
  if (typeof value === "string") return normalise(value);
  if (Array.isArray(value)) return value.map(comparable);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, comparable(v)]),
    );
  }
  return value;
};

const PHOTO_FIELDS = ["uniquePhotos", "shownPhotos", "droppedPositions"];

// Expected reasons name only the positions the CSV pins down.
function onlyExpectedReasons(
  actual: Record<string, unknown>,
  expected: Expectation,
) {
  if (!expected.dropReasons) return actual;
  const reasons = actual.dropReasons as Record<string, unknown>;
  return {
    ...actual,
    dropReasons: Object.fromEntries(
      Object.keys(expected.dropReasons).map((p) => [p, reasons[p]]),
    ),
  };
}

type Diff = { field: string; text: string };

const TRIAGE_FIELDS = new Set([
  "shownPhotos",
  "droppedPositions",
  "dropReasons",
  "logoSource",
  "logoColourClass",
]);

// What was stored for the logo: only a PNG, never an svg.
function storedLogoFiles(name: string, storageDir: string) {
  const dir = join(storageDir, "logos", name);
  return existsSync(dir) ? readdirSync(dir).sort() : [];
}

async function probeLogo(
  outcome: Outcome,
  storageDir: string,
  withCentre: boolean,
) {
  const logo =
    outcome.ok && "result" in outcome
      ? "brand" in outcome.result
        ? outcome.result.brand.logo
        : null
      : null;
  if (!logo?.pngPath) return null;
  const { data, info } = await sharp(
    readFileSync(join(storageDir, "logos", logo.pngPath)),
  )
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const at = (x: number, y: number) => {
    const i =
      (Math.floor(y * info.height) * info.width + Math.floor(x * info.width)) *
      4;
    return {
      alpha: data[i + 3] ?? 0,
      min: Math.min(data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0),
      red: (data[i] ?? 0) > 200 && (data[i + 1] ?? 255) < 60,
    };
  };
  const corner = at(0, 0);
  const inside = at(0.25, 0.5);
  const middle = at(0.5, 0.5);
  return {
    corner: corner.alpha < 10 ? "clear" : "opaque",
    interior:
      inside.alpha < 10 ? "clear" : inside.min >= 240 ? "white" : "dark",
    ...(withCentre && {
      centre: middle.alpha >= 250 && middle.red ? "red" : "other",
    }),
  };
}

function mismatches(
  expected: Expectation,
  outcome: Outcome,
  extra: Record<string, unknown> = {},
) {
  const actual = {
    ...onlyExpectedReasons(observe(outcome), expected),
    ...extra,
  };
  const ingested = outcome.ok && "result" in outcome;
  // Acceptance rule: no ingesting row may ask the tester to pick a variant unless it says so.
  const checked: Record<string, unknown> = {
    ...expected,
    ...(ingested && {
      needsVariantChoice: expected.needsVariantChoice ?? false,
    }),
  };
  for (const field of [
    "existingWorkspaces",
    "note",
    "triage",
    "triageActual",
  ]) {
    delete checked[field];
  }
  const diffs: Diff[] = Object.entries(checked)
    .filter(
      ([field, want]) =>
        want !== undefined &&
        !isDeepStrictEqual(comparable(want), comparable(actual[field])),
    )
    .map(([field, want]) => ({
      field,
      text: `${field}: expected ${JSON.stringify(want)}, got ${JSON.stringify(actual[field])}`,
    }));
  const unpinned = ingested
    ? PHOTO_FIELDS.filter((field) => checked[field] === undefined)
    : [];
  return { diffs, actual, unpinned };
}

async function runCase(name: string, dir: string, expected: Expectation) {
  const { url } = readSnapshotJson(dir, "case.json", caseSchema);
  const storageDir = mkdtempSync(join(tmpdir(), "golden-"));
  const deps = createIntakeDeps({
    snapshotDir: dir,
    storage: createLocalStorage(storageDir),
    findWorkspace: async (key) => expected.existingWorkspaces?.[key] ?? null,
  });
  try {
    const run = hasBrandPages(dir) ? runIntake : runIntakeUntilBrand;
    const outcome = await run({ url, intakeId: name }, deps);
    if (expected.throws) {
      return {
        diffs: [
          {
            field: "throws",
            text: `expected a throw containing "${expected.throws}"`,
          },
        ],
        actual: {},
        unpinned: [],
      };
    }
    const probe = {
      ...(expected.logoProbe && {
        logoProbe: await probeLogo(
          outcome,
          storageDir,
          "centre" in expected.logoProbe,
        ),
      }),
      ...(expected.storedLogoFiles && {
        storedLogoFiles: storedLogoFiles(name, storageDir),
      }),
    };
    return mismatches(expected, outcome, probe);
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error);
    if (expected.throws && text.includes(expected.throws)) {
      return { diffs: [], actual: {}, unpinned: [] };
    }
    return {
      diffs: [
        {
          field: "threw",
          text: `threw: ${text}`,
        },
      ],
      actual: {},
      unpinned: [],
    };
  } finally {
    rmSync(storageDir, { recursive: true, force: true });
  }
}

async function main() {
  let failed = 0;
  let triaged = 0;
  let passed = 0;
  for (const [name, expected] of Object.entries(loadExpectations())) {
    const dir = snapshotDirOf(name);
    if (!dir) {
      console.log(`SKIP ${name} (no snapshot)`);
      continue;
    }
    const { diffs, actual, unpinned } = await runCase(name, dir, expected);
    const judgement = diffs.filter((d) => TRIAGE_FIELDS.has(d.field));
    const rest = diffs.filter((d) => !TRIAGE_FIELDS.has(d.field));
    const pinned = expected.triageActual ?? {};
    const atTriage =
      judgement.every((d) => d.field in pinned) &&
      Object.entries(pinned).every(([field, value]) =>
        isDeepStrictEqual(value, actual[field]),
      );

    if (diffs.length === 0) {
      passed++;
      console.log(
        expected.triage
          ? `PASS ${name} (now matches the CSV: the triage marker can be removed)`
          : `PASS ${name}`,
      );
    } else if (
      expected.triage &&
      rest.length === 0 &&
      Object.keys(pinned).length > 0 &&
      atTriage
    ) {
      triaged++;
      const text = judgement.map((d) => d.text).join("; ");
      console.log(`TRIAGE ${name}: ${text} — ${expected.triage}`);
    } else {
      failed++;
      const drift =
        expected.triage && rest.length === 0 && !atTriage
          ? ["output drifted from triageActual"]
          : [];
      console.log(
        `FAIL ${name}\n  ${[...drift, ...diffs.map((d) => d.text)].join("\n  ")}`,
      );
    }
    if (unpinned.length > 0 && dir.startsWith(".golden")) {
      console.log(`  SKIP photo fields not pinned: ${unpinned.join(", ")}`);
    }
  }
  console.log(`${passed} passed, ${triaged} triage, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
