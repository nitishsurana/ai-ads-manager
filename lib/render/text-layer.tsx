import { Resvg } from "@resvg/resvg-js";
import type { ReactNode } from "react";
import satori, { type SatoriNode } from "satori";
import { CANVAS } from "./canvas";
import { fontStack, satoriFonts, type FontSet } from "./fonts";
import type { Layout, TextLayout } from "./layout";
import { ROW_GAP, ROW_LINE_HEIGHT } from "./badge";

// What logo.ts sizes the wordmark's box by.
export const WORDMARK_LINE_HEIGHT = 1.2;

const STAR =
  "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z";

const absolute = (box: { x: number; y: number; w: number; h: number }) => ({
  position: "absolute" as const,
  left: box.x,
  top: box.y,
  width: box.w,
  height: box.h,
  display: "flex" as const,
});

function Lines({ text, id }: { text: TextLayout; id: string }) {
  return (
    <div
      key={id}
      style={{
        ...absolute(text.box),
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        color: text.colour,
        fontFamily: fontStack(text.font.family),
        fontWeight: text.font.weight,
        fontSize: text.size,
        lineHeight: text.lineHeight,
        letterSpacing: text.tracking * text.size,
      }}
    >
      {text.lines.map((line, index) => (
        <div
          key={`${id}:${index}`}
          style={{ display: "flex", whiteSpace: "nowrap" }}
        >
          {line}
        </div>
      ))}
    </div>
  );
}

function Badge({ badge }: { badge: NonNullable<Layout["badge"]> }) {
  return (
    <div
      key="badge"
      style={{
        ...absolute(badge.box),
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: ROW_GAP,
        background: badge.background,
        color: badge.colour,
        borderRadius: badge.radius,
        fontFamily: fontStack(badge.font.family),
      }}
    >
      {badge.rows.map((row, index) => (
        <div
          key={`badge:${index}`}
          style={{
            display: "flex",
            alignItems: "center",
            gap: row.size * 0.25,
            fontSize: row.size,
            fontWeight: row.weight,
            lineHeight: ROW_LINE_HEIGHT,
            whiteSpace: "nowrap",
            textDecoration: row.strike ? "line-through" : "none",
          }}
        >
          {row.star ? (
            <svg width={row.size} height={row.size} viewBox="0 0 24 24">
              <path d={STAR} fill={badge.colour} />
            </svg>
          ) : null}
          {row.text}
        </div>
      ))}
    </div>
  );
}

function Logo({
  logo,
  image,
}: {
  logo: NonNullable<Layout["logo"]>;
  image: string | null;
}) {
  return (
    <>
      {logo.panel ? (
        <div
          key="logo-panel"
          style={{
            ...absolute(logo.panel.box),
            background: logo.panel.colour,
            borderRadius: logo.panel.radius,
          }}
        />
      ) : null}
      {logo.kind === "wordmark" && logo.wordmark ? (
        <div
          key="logo"
          style={{
            ...absolute(logo.box),
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            whiteSpace: "nowrap",
            color: logo.ink ?? "#ffffff",
            fontFamily: fontStack(logo.wordmark.font.family),
            fontWeight: 700,
            fontSize: logo.wordmark.size,
            lineHeight: WORDMARK_LINE_HEIGHT,
          }}
        >
          {logo.wordmark.lines.map((line, index) => (
            <div key={`logo:${index}`} style={{ display: "flex" }}>
              {line}
            </div>
          ))}
        </div>
      ) : image ? (
        // eslint-disable-next-line @next/next/no-img-element -- Satori draws plain img elements
        <img
          key="logo"
          src={image}
          width={logo.box.w}
          height={logo.box.h}
          alt=""
          style={{ position: "absolute", left: logo.box.x, top: logo.box.y }}
        />
      ) : null}
    </>
  );
}

function TextLayer({
  layout,
  logo,
}: {
  layout: Layout;
  logo: string | null;
}): ReactNode {
  return (
    <div
      style={{
        display: "flex",
        position: "relative",
        width: CANVAS.width,
        height: CANVAS.height,
      }}
    >
      {layout.eyebrow ? <Lines text={layout.eyebrow} id="eyebrow" /> : null}
      <Lines text={layout.headline} id="headline" />
      <div
        key="cta"
        style={{
          ...absolute(layout.cta.box),
          alignItems: "center",
          justifyContent: "center",
          background: layout.cta.background,
          borderRadius: layout.cta.radius,
        }}
      >
        <Lines
          id="cta-label"
          text={{
            ...layout.cta,
            box: { x: 0, y: 0, w: layout.cta.box.w, h: layout.cta.box.h },
          }}
        />
      </div>
      {layout.badge ? <Badge badge={layout.badge} /> : null}
      {layout.logo ? <Logo logo={layout.logo} image={logo} /> : null}
    </div>
  );
}

export type NodeBox = {
  key: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

// The transparent 1080x1920 text layer as PNG, and the boxes Satori laid the elements out in.
export async function renderTextLayer(
  layout: Layout,
  options: { fonts: FontSet; logo: string | null },
) {
  const nodes: NodeBox[] = [];
  const svg = await satori(<TextLayer layout={layout} logo={options.logo} />, {
    width: CANVAS.width,
    height: CANVAS.height,
    fonts: satoriFonts(options.fonts),
    onNodeDetected: (node: SatoriNode) => {
      if (node.key !== undefined) {
        nodes.push({
          key: String(node.key),
          x: node.left,
          y: node.top,
          w: node.width,
          h: node.height,
        });
      }
    },
  });
  const png = new Resvg(svg, { fitTo: { mode: "original" } }).render().asPng();
  return { png, nodes };
}

// Lines Satori measured wider than the box the layout gave them, or a different number of lines than planned.
export function nodeProblems(layout: Layout, nodes: NodeBox[]) {
  const problems: string[] = [];
  const blocks: [string, TextLayout | null][] = [
    ["eyebrow", layout.eyebrow],
    ["headline", layout.headline],
    ["cta-label", layout.cta],
  ];
  for (const [id, text] of blocks) {
    if (!text) continue;
    const lines = nodes.filter((node) => node.key.startsWith(`${id}:`));
    if (lines.length !== text.lines.length) {
      problems.push(
        `${id}: ${lines.length} lines drawn, ${text.lines.length} planned`,
      );
    }
    if (id === "cta-label" && lines.length > 0) {
      const first = lines[0];
      const last = lines[lines.length - 1];
      const above = (first?.y ?? 0) - text.box.y;
      const below = text.box.y + text.box.h - ((last?.y ?? 0) + (last?.h ?? 0));
      if (Math.abs(above - below) > 3) {
        problems.push(
          `cta-label: text sits ${Math.round(above)} px from the top and ${Math.round(below)} px from the bottom`,
        );
      }
    }
    const widest = Math.max(0, ...lines.map((line) => line.w));
    if (widest > text.box.w + 2) {
      problems.push(
        `${id}: a line is ${Math.round(widest)} px, the box is ${text.box.w}`,
      );
    }
  }
  const mark = layout.logo?.kind === "wordmark" ? layout.logo : null;
  if (mark?.wordmark) {
    const lines = nodes.filter((node) => node.key.startsWith("logo:"));
    if (lines.length !== mark.wordmark.lines.length) {
      problems.push(
        `logo: ${lines.length} lines drawn, ${mark.wordmark.lines.length} planned`,
      );
    }
    if (Math.max(0, ...lines.map((line) => line.w)) > mark.box.w + 2) {
      problems.push(`logo: a line is wider than the box (${mark.box.w})`);
    }
    if (lines.reduce((sum, line) => sum + line.h, 0) > mark.box.h + 2) {
      problems.push(`logo: the lines are taller than the box (${mark.box.h})`);
    }
  }
  return problems;
}
