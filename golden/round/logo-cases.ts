import type { Box, LogoGeometry } from "@/lib/render/canvas";
import { flatBackdrop, type Backdrop, type Rgb } from "@/lib/render/colour";
import type { LogoLayout } from "@/lib/render/layout";
import { placeLogo, type LogoSpec } from "@/lib/render/logo";
import { same, type Case } from "./cases";
import { measure, noGlyph } from "./layout-cases";

const MAGENTA: Rgb = [237, 40, 140];
const BUSY: Backdrop = {
  mean: [119, 119, 119],
  dark: [0, 0, 0],
  light: [255, 255, 255],
  busy: 90,
};
const on = (colour: Rgb) => () => flatBackdrop(colour);

const spec = (over: Partial<LogoSpec> = {}): LogoSpec => ({
  kind: "image",
  aspect: 3,
  colourClass: "one_colour",
  colours: [[34, 34, 34]],
  headerBackground: null,
  badge: false,
  wordmark: "Acme",
  brandInk: null,
  ...over,
});

const wordmark = (text: string) => spec({ kind: "wordmark", wordmark: text });

const image = (over: Partial<LogoLayout>): LogoLayout => ({
  kind: "image",
  box: { x: 773, y: 1738, w: 259, h: 86 },
  decision: "as_is",
  corner: "bottom_right",
  ink: null,
  contrast: 0,
  panel: null,
  wordmark: null,
  ...over,
});

const drawn = (lines: string[], size: number) => ({
  text: "Acme",
  lines,
  font: { family: "Inter", weight: 700 as const, fallback: false },
  size,
});

const PANEL_BOX = { x: 745, y: 1710, w: 287, h: 114 };
const INNER_BOX = { x: 759, y: 1724, w: 259, h: 86 };
const TEAL: Rgb[] = [
  [26, 143, 138],
  [255, 255, 255],
];

type Row = {
  name: string;
  spec: LogoSpec;
  sample: (box: Box) => Backdrop;
  geometry?: LogoGeometry;
  expected: { logo: LogoLayout | null; reason: string | null };
};

const ROWS: Row[] = [
  {
    name: "geometry 2 draws a one-colour logo up to 259 x 132 px, 48 px from the side and 96 px from the bottom",
    spec: spec(),
    sample: on([240, 240, 240]),
    expected: { logo: image({ contrast: 13.96 }), reason: null },
  },
  {
    name: "geometry 1 keeps the earlier box: 194 px wide inside the safe margins",
    spec: spec(),
    sample: on([240, 240, 240]),
    geometry: 1,
    expected: {
      logo: image({
        box: { x: 821, y: 1663, w: 194, h: 65 },
        contrast: 13.96,
      }),
      reason: null,
    },
  },
  {
    name: "a one-colour logo is recoloured light on a dark area",
    spec: spec(),
    sample: on([20, 20, 40]),
    expected: {
      logo: image({ decision: "recoloured", ink: "#ffffff", contrast: 18.1 }),
      reason: null,
    },
  },
  {
    name: "a currentColor logo is always drawn in a chosen ink",
    spec: spec({ colourClass: "current_colour", colours: [] }),
    sample: on([240, 240, 240]),
    expected: {
      logo: image({ decision: "recoloured", ink: "#111111", contrast: 16.57 }),
      reason: null,
    },
  },
  {
    name: "an area that is both dark and light puts a one-colour logo on a neutral panel, drawn in its best ink",
    spec: spec(),
    sample: () => BUSY,
    expected: {
      logo: image({
        box: INNER_BOX,
        decision: "panel",
        ink: "#111111",
        contrast: 18.88,
        panel: { box: PANEL_BOX, colour: "#ffffff", radius: 14 },
      }),
      reason: null,
    },
  },
  {
    name: "geometry 1 drops a one-colour logo and its wordmark when neither reads",
    spec: spec(),
    sample: () => BUSY,
    geometry: 1,
    expected: {
      logo: null,
      reason:
        "the logo lacks contrast anywhere; the wordmark lacks contrast; no logo is drawn",
    },
  },
  {
    name: "a badge is drawn as it is in the home corner whatever is behind it",
    spec: spec({ badge: true, colourClass: "multi_colour", colours: TEAL }),
    sample: () => BUSY,
    expected: {
      logo: image({ decision: "badge", contrast: 1.14 }),
      reason: null,
    },
  },
  {
    name: "a badge whose field matches what is behind it goes on the neutral panel",
    spec: spec({ badge: true, colourClass: "multi_colour", colours: TEAL }),
    sample: on([30, 140, 136]),
    expected: {
      logo: image({
        box: INNER_BOX,
        decision: "panel",
        contrast: 4.8,
        panel: { box: PANEL_BOX, colour: "#111111", radius: 14 },
      }),
      reason: null,
    },
  },
  {
    name: "geometry 1 has no badge: the logo takes the earlier chain, down to its wordmark",
    spec: spec({ badge: true, colourClass: "multi_colour", colours: TEAL }),
    sample: on(MAGENTA),
    geometry: 1,
    expected: {
      logo: {
        kind: "wordmark",
        box: { x: 927, y: 1675, w: 88, h: 53 },
        decision: "wordmark",
        corner: "bottom_right",
        ink: "#111111",
        contrast: 4.75,
        panel: null,
        wordmark: drawn(["Acme"], 44),
      },
      reason: "the logo lacks contrast anywhere",
    },
  },
  {
    name: "a multi-colour logo that fails moves to a calmer corner, 48 px from the left",
    spec: spec({
      colourClass: "multi_colour",
      colours: [MAGENTA, [120, 30, 90]],
    }),
    sample: (box) =>
      flatBackdrop(box.x > 500 && box.y > 1000 ? MAGENTA : [250, 250, 250]),
    expected: {
      logo: image({
        box: { x: 48, y: 1738, w: 259, h: 86 },
        decision: "calmer_corner",
        corner: "bottom_left",
        contrast: 3.81,
      }),
      reason: null,
    },
  },
  {
    name: "a multi-colour logo with no calm corner goes on its header-colour panel",
    spec: spec({
      colourClass: "multi_colour",
      colours: [MAGENTA],
      headerBackground: [255, 255, 255],
    }),
    sample: on(MAGENTA),
    expected: {
      logo: image({
        box: INNER_BOX,
        decision: "header_panel",
        contrast: 3.97,
        panel: { box: PANEL_BOX, colour: "#ffffff", radius: 14 },
      }),
      reason: null,
    },
  },
  {
    name: "a multi-colour logo with no panel of its own keeps its colours on the neutral panel that reads best",
    spec: spec({ colourClass: "multi_colour", colours: [MAGENTA] }),
    sample: on(MAGENTA),
    expected: {
      logo: image({
        box: INNER_BOX,
        decision: "panel",
        contrast: 4.75,
        panel: { box: PANEL_BOX, colour: "#111111", radius: 14 },
      }),
      reason: null,
    },
  },
  {
    name: "geometry 1 sends the same logo to the wordmark",
    spec: spec({ colourClass: "multi_colour", colours: [MAGENTA] }),
    sample: on(MAGENTA),
    geometry: 1,
    expected: {
      logo: {
        kind: "wordmark",
        box: { x: 927, y: 1675, w: 88, h: 53 },
        decision: "wordmark",
        corner: "bottom_right",
        ink: "#111111",
        contrast: 4.75,
        panel: null,
        wordmark: drawn(["Acme"], 44),
      },
      reason: "the logo lacks contrast anywhere",
    },
  },
  {
    name: "a wordmark that lacks contrast goes on a neutral panel",
    spec: wordmark("Acme"),
    sample: () => BUSY,
    expected: {
      logo: {
        kind: "wordmark",
        box: { x: 906, y: 1742, w: 112, h: 68 },
        decision: "panel",
        corner: "bottom_right",
        ink: "#111111",
        contrast: 18.88,
        panel: {
          box: { x: 892, y: 1728, w: 140, h: 96 },
          colour: "#ffffff",
          radius: 14,
        },
        wordmark: drawn(["Acme"], 56),
      },
      reason: null,
    },
  },
  {
    name: "geometry 1 drops a wordmark that lacks contrast",
    spec: wordmark("Acme"),
    sample: () => BUSY,
    geometry: 1,
    expected: {
      logo: null,
      reason: "the wordmark lacks contrast; no logo is drawn",
    },
  },
  {
    name: "a wordmark too wide for one line wraps onto two",
    spec: wordmark("Weekend Coffee Roasters Co."),
    sample: on([255, 255, 255]),
    expected: {
      logo: {
        kind: "wordmark",
        box: { x: 773, y: 1734, w: 259, h: 90 },
        decision: "wordmark",
        corner: "bottom_right",
        ink: "#111111",
        contrast: 18.88,
        panel: null,
        wordmark: {
          ...drawn(["Weekend Coffee", "Roasters Co."], 37),
          text: "Weekend Coffee Roasters Co.",
        },
      },
      reason: null,
    },
  },
  {
    name: "a wordmark too long for the 24% cap even on two lines is dropped with a reason",
    spec: wordmark("A very long store name indeed and then some more words"),
    sample: on([255, 255, 255]),
    expected: {
      logo: null,
      reason:
        "the wordmark needs 334 px, over the 259 px cap, at its smallest legible size, even on two lines; no logo is drawn",
    },
  },
  {
    name: "a wordmark with glyphs no font has is dropped with a reason",
    spec: wordmark("週末珈琲"),
    sample: on([255, 255, 255]),
    expected: {
      logo: null,
      reason: "no font has every glyph of the wordmark; no logo is drawn",
    },
  },
];

export const LOGO_CASES: Case[] = ROWS.map(
  ({ name, spec: logo, sample, geometry = 2, expected }) => ({
    name: `logo: ${name}`,
    run: () =>
      same(
        placeLogo(logo, {
          geometry,
          sample,
          avoid: [],
          measure,
          fontFamily: "Inter",
          fallback: () => false,
          unsupported: noGlyph,
        }),
        expected,
      ),
  }),
);
