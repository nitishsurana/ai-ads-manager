import { layoutProblems } from "@/lib/round/checks/layout";
import type { Layout } from "@/lib/render";
import type { Copy } from "@/lib/round/types";
import { applyAnswers, initialConfirm } from "@/lib/confirm";
import { freezeInputs } from "@/lib/round/inputs";
import { loadExpectations } from "../expectations";
import { replayIntake, snapshotDirOf } from "../replay";
import { parseS1 } from "../s1-answers";
import { same, type Case } from "./cases";
import { BADGE, LAYOUT, row } from "./layout-fixture";
import { BASE_INPUTS } from "./render-cases";

type Subject = Parameters<typeof layoutProblems>[1];

const COPY: Copy = {
  eyebrow: null,
  headline: "Slow mornings",
  cta: "Shop now",
};

const SUBJECT: Subject = {
  supportingElement: null,
  offerFactId: null,
  copy: COPY,
};

const problemsOf = (
  layout: Layout,
  subject: Partial<Subject> = {},
  glyphs: (family: string, text: string) => number[] = () => [],
) => layoutProblems(layout, { ...SUBJECT, ...subject }, BASE_INPUTS, glyphs);

const mentions = (problems: string[], prefix: string) =>
  problems.some((p) => p.startsWith(prefix));

const LAYOUT_CHECKS: Case[] = [
  {
    name: "layer 1 layout: a clean layout has no problems",
    run: () => same(problemsOf(LAYOUT), []),
  },
  {
    name: "layer 1 layout: a headline over 6 words or a CTA over 3 words breaks the limits",
    run: () => {
      const copied = (copy: Partial<Copy>) =>
        mentions(
          layoutProblems(
            LAYOUT,
            { ...SUBJECT, copy: { ...COPY, ...copy } },
            BASE_INPUTS,
            () => [],
          ),
          "words",
        );
      return same(
        [
          copied({ headline: "one two three four five six seven" }),
          copied({ eyebrow: "A B C", headline: "one two three four five six" }),
          copied({ cta: "Shop now please friends" }),
        ],
        [true, true, true],
      );
    },
  },
  {
    name: "layer 1 layout: a box outside the 65 / 192 px margins fails",
    run: () =>
      same(
        mentions(
          problemsOf({
            ...LAYOUT,
            headline: {
              ...LAYOUT.headline,
              box: { x: 20, y: 200, w: 900, h: 200 },
            },
          }),
          "margins",
        ) &&
          mentions(
            problemsOf({
              ...LAYOUT,
              cta: { ...LAYOUT.cta, box: { x: 300, y: 1750, w: 480, h: 120 } },
            }),
            "margins",
          ),
        true,
      ),
  },
  {
    name: "layer 1 layout: a stored headline contrast under 4.5 fails",
    run: () =>
      same(
        mentions(
          problemsOf({
            ...LAYOUT,
            headline: { ...LAYOUT.headline, contrast: 3.2 },
          }),
          "contrast",
        ),
        true,
      ),
  },
  {
    name: "layer 1 layout: a CTA colour within ΔE 20 of a brand colour fails",
    run: () =>
      same(
        mentions(
          problemsOf({
            ...LAYOUT,
            cta: { ...LAYOUT.cta, background: "#f4b942", colour: "#111111" },
          }),
          "cta colour",
        ),
        true,
      ),
  },
  {
    name: "layer 1 layout: text over the product fails by 1 px, passes when touching, and is skipped without keepClear",
    run: () => {
      // The headline box ends at y 400.
      const withProduct = (y: number, keepClear: boolean): Layout => ({
        ...LAYOUT,
        keepClear,
        product: { x: 100, y, w: 300, h: 200 },
      });
      return same(
        [
          problemsOf(withProduct(399, true)),
          problemsOf(withProduct(400, true)),
          problemsOf(withProduct(399, false)),
          problemsOf({
            ...withProduct(1480, true),
            cta: { ...LAYOUT.cta, box: { x: 300, y: 1500, w: 480, h: 120 } },
          }),
        ],
        [
          ["text: the eyebrow, headline or CTA covers the product"],
          [],
          [],
          ["text: the eyebrow, headline or CTA covers the product"],
        ],
      );
    },
  },
  {
    name: "layer 1 layout: a glyph no font has fails",
    run: () =>
      same(
        mentions(
          problemsOf(LAYOUT, {}, () => [0x20b9]),
          "glyphs",
        ),
        true,
      ),
  },
  {
    name: "layer 1 layout: a headline or CTA the layout could not fit fails",
    run: () =>
      same(
        mentions(
          problemsOf({
            ...LAYOUT,
            dropped: [{ element: "headline", reason: "x" }],
          }),
          "layout",
        ),
        true,
      ),
  },
  {
    name: "layer 1 logo: drawn when none was found, moved without a reason, too wide, or missing without a drop fail",
    run: () => {
      const logo = {
        kind: "image" as const,
        box: { x: 800, y: 1600, w: 200, h: 60 },
        decision: "as_is" as const,
        corner: "bottom_right" as const,
        ink: null,
        contrast: 5,
        panel: null,
        wordmark: null,
      };
      const check = (layout: Layout, inputs = BASE_INPUTS) =>
        layoutProblems(layout, SUBJECT, inputs, () => []);
      const stub = {
        source: "header" as const,
        pngPath: "x",
        width: 260,
        height: 90,
        sourceUrl: null,
        text: null,
        textRead: null,
        colourClass: "one_colour" as const,
        colours: ["#222222"],
        transparent: true,
        headerBackground: null,
        iconOnly: false,
        storeBrand: true,
      };
      const present = { ...BASE_INPUTS, logo: stub };
      return same(
        [
          mentions(check({ ...LAYOUT, logo }), "logo"),
          mentions(
            check(
              { ...LAYOUT, logo: { ...logo, corner: "top_left" } },
              present,
            ),
            "logo",
          ),
          mentions(
            check(
              { ...LAYOUT, logo: { ...logo, box: { ...logo.box, w: 300 } } },
              present,
            ),
            "logo",
          ),
          mentions(check(LAYOUT, present), "logo"),
          mentions(
            check(
              { ...LAYOUT, dropped: [{ element: "logo", reason: "no room" }] },
              present,
            ),
            "logo",
          ),
          mentions(
            check({ ...LAYOUT, logo: { ...logo, contrast: 2 } }, present),
            "contrast",
          ),
        ],
        [true, true, true, true, false, true],
      );
    },
  },
  {
    name: "layer 1 logo: a wordmark-source logo must be drawn as a wordmark with that name, in glyphs a font has",
    run: () => {
      const source = {
        source: "wordmark" as const,
        pngPath: null,
        width: null,
        height: null,
        sourceUrl: null,
        text: "Weekend Coffee Co.",
        textRead: null,
        colourClass: null,
        colours: [],
        transparent: true,
        headerBackground: null,
        iconOnly: false,
        storeBrand: true,
      };
      const inputs = { ...BASE_INPUTS, logo: source };
      const box = { x: 800, y: 1600, w: 190, h: 58 };
      const mark = (text: string, kind: "wordmark" | "image" = "wordmark") => ({
        kind,
        box,
        decision: "wordmark" as const,
        corner: "bottom_right" as const,
        ink: "#ffffff",
        contrast: 5,
        panel: null,
        wordmark:
          kind === "wordmark"
            ? {
                text,
                lines: [text],
                font: {
                  family: "Inter",
                  weight: 700 as const,
                  fallback: false,
                },
                size: 24,
              }
            : null,
      });
      const check = (layout: Layout, missing: number[] = []) =>
        layoutProblems(layout, SUBJECT, inputs, () => missing);
      const faults = (layout: Layout, missing?: number[]) =>
        check(layout, missing).filter((p) => p.startsWith("logo"));
      return same(
        [
          faults({ ...LAYOUT, logo: mark("Weekend Coffee Co.") }),
          faults({ ...LAYOUT, logo: mark("Other Name") }).length,
          faults({ ...LAYOUT, logo: mark("", "image") }).length,
          check({ ...LAYOUT, logo: mark("Weekend Coffee Co.") }, [0x9031]).some(
            (p) => p.startsWith("glyphs"),
          ),
        ],
        [[], 1, 1, true],
      );
    },
  },
  {
    name: "layer 1 element: the badge must be the confirmed price, with its strike-through, and for the planned element",
    run: () => {
      const price = {
        ...LAYOUT,
        badge: BADGE("price", [row("$24.00"), row("$30.00", { strike: true })]),
      };
      const subject = { supportingElement: "price" as const };
      return same(
        [
          problemsOf(price, subject),
          mentions(
            problemsOf(
              {
                ...price,
                badge: BADGE("price", [
                  row("$25.00"),
                  row("$30.00", { strike: true }),
                ]),
              },
              subject,
            ),
            "element",
          ),
          mentions(
            problemsOf(
              { ...price, badge: BADGE("price", [row("$24.00")]) },
              subject,
            ),
            "element",
          ),
          mentions(problemsOf(LAYOUT, subject), "element"),
          mentions(
            problemsOf(price, { supportingElement: "rating" }),
            "element",
          ),
          mentions(problemsOf(price), "element"),
        ],
        [[], true, true, true, true, true],
      );
    },
  },
  {
    name: "layer 1 element: the rating shows its star, value and count; an offer is word for word",
    run: () => {
      const rating = {
        ...LAYOUT,
        badge: BADGE("rating", [
          row("4.7", { star: true }),
          row("1,284 reviews"),
        ]),
      };
      const offer = {
        ...LAYOUT,
        offerFactId: "offer",
        badge: BADGE("offer", [row("Free shipping"), row("over $50")]),
      };
      return same(
        [
          problemsOf(rating, { supportingElement: "rating" }),
          problemsOf(offer, {
            supportingElement: "offer",
            offerFactId: "offer",
          }),
          mentions(
            problemsOf(
              { ...offer, badge: BADGE("offer", [row("Free shipping")]) },
              { supportingElement: "offer", offerFactId: "offer" },
            ),
            "element",
          ),
          mentions(
            problemsOf(
              {
                ...rating,
                badge: BADGE("rating", [row("4.7"), row("1,284 reviews")]),
              },
              { supportingElement: "rating" },
            ),
            "element",
          ),
        ],
        [[], [], true, true],
      );
    },
  },
];

// The committed fixture brand-name-missing has no logo: a typed name freezes as the text wordmark, a blank answer freezes no logo.
const FREEZE_CASES: Case[] = ["typed-name", "blank-answer"].map((name) => ({
  name: `freeze: ${name} with no logo found`,
  run: async () => {
    const fixture = "brand-name-missing";
    const script = loadExpectations()[fixture]?.scenarios?.[name];
    const dir = snapshotDirOf(fixture);
    if (!script || !dir) return "the fixture or its scenario is missing";
    const result = await replayIntake(fixture, dir);
    const state = applyAnswers(
      initialConfirm(result),
      parseS1(script.s1, []).answers,
    );
    const { logo } = freezeInputs({
      title: result.product.title,
      sourceUrl: result.finalUrl,
      campaign: {},
      state,
      photos: [],
      facts: [],
    });
    return same(
      logo && { source: logo.source, text: logo.text, png: logo.pngPath },
      script.confirm.logoSource === "wordmark"
        ? { source: "wordmark", text: script.confirm.brandName, png: null }
        : null,
    );
  },
}));

export const CHECK_CASES = [...LAYOUT_CHECKS, ...FREEZE_CASES];
