import type { CSSProperties } from "react";
import { CANVAS, SAFE_BOX } from "@/lib/render/canvas";
import type { Layout } from "@/lib/render/layout";
import type { CreativeView } from "@/lib/round";
import { editProblem } from "@/lib/round/copy/limits";

// Room for the field's padding and dashed border around three lines of text.
const HEADLINE_PAD = 90;

const pct = (value: number, of: number) => `${(value / of) * 100}%`;
// The container query unit: 1cqw is 1% of the creative's width.
const cqw = (px: number) => `${(px / CANVAS.width) * 100}cqw`;

function place(box: { x: number; y: number; w: number; h: number }) {
  return {
    position: "absolute",
    left: pct(box.x, CANVAS.width),
    top: pct(box.y, CANVAS.height),
    width: pct(box.w, CANVAS.width),
    height: pct(box.h, CANVAS.height),
  } satisfies CSSProperties;
}

const face = (family: string, weight: number): CSSProperties => ({
  fontFamily: `"${family}", sans-serif`,
  fontWeight: weight,
});

function Scrim({ scrim }: { scrim: NonNullable<Layout["scrim"]> }) {
  const solid = Math.max(0, ((scrim.box.h - 220) / scrim.box.h) * 100);
  const colour = `color-mix(in srgb, ${scrim.colour} ${scrim.opacity * 100}%, transparent)`;
  const direction = scrim.edge === "top" ? "to bottom" : "to top";
  return (
    <div
      aria-hidden="true"
      style={{
        ...place(scrim.box),
        background: `linear-gradient(${direction}, ${colour} 0%, ${colour} ${solid}%, transparent 100%)`,
      }}
    />
  );
}

function Lines({ text }: { text: NonNullable<Layout["eyebrow"]> }) {
  return (
    <div
      aria-hidden="true"
      style={{
        ...place(text.box),
        ...face(text.font.family, text.font.weight),
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        color: text.colour,
        fontSize: cqw(text.size),
        lineHeight: text.lineHeight,
        letterSpacing: `${text.tracking}em`,
        whiteSpace: "nowrap",
      }}
    >
      {text.lines.map((line, index) => (
        <div key={index}>{line}</div>
      ))}
    </div>
  );
}

function Badge({ badge }: { badge: NonNullable<Layout["badge"]> }) {
  return (
    <div
      aria-hidden="true"
      style={{
        ...place(badge.box),
        ...face(badge.font.family, 700),
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: badge.background,
        color: badge.colour,
        borderRadius: cqw(badge.radius),
      }}
    >
      {badge.rows.map((row, index) => (
        <div
          key={index}
          style={{
            fontSize: cqw(row.size),
            fontWeight: row.weight,
            lineHeight: 1.1,
            whiteSpace: "nowrap",
            textDecoration: row.strike ? "line-through" : "none",
          }}
        >
          {row.star ? "★ " : ""}
          {row.text}
        </div>
      ))}
    </div>
  );
}

function Logo({
  logo,
  url,
}: {
  logo: NonNullable<Layout["logo"]>;
  url: string | null;
}) {
  return (
    <>
      {logo.panel && (
        <div
          aria-hidden="true"
          style={{
            ...place(logo.panel.box),
            background: logo.panel.colour,
            borderRadius: cqw(logo.panel.radius),
          }}
        />
      )}
      {logo.kind === "wordmark" && logo.wordmark ? (
        <div
          aria-hidden="true"
          style={{
            ...place(logo.box),
            ...face(logo.wordmark.font.family, 700),
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            color: logo.ink ?? "#ffffff",
            fontSize: cqw(logo.wordmark.size),
            lineHeight: 1.2,
            whiteSpace: "nowrap",
          }}
        >
          {logo.wordmark.lines.map((line, index) => (
            <div key={index}>{line}</div>
          ))}
        </div>
      ) : url ? (
        // eslint-disable-next-line @next/next/no-img-element -- a signed storage URL
        <img
          src={url}
          alt=""
          aria-hidden="true"
          style={{ ...place(logo.box), objectFit: "contain" }}
        />
      ) : null}
    </>
  );
}

type CreativeEditorProps = {
  creative: CreativeView;
  headline: string;
  cta: string;
  onHeadline: (text: string) => void;
  onCta: (text: string) => void;
};

// The edit overlay: the stored background and an HTML copy of the layout's text layer; approximate, since the server draws the real creative on save.
export function CreativeEditor({
  creative,
  headline,
  cta,
  onHeadline,
  onCta,
}: CreativeEditorProps) {
  const { layout, copy } = creative;
  const over = editProblem({ headline, cta, eyebrow: copy.eyebrow });
  const headlineOver =
    over === "edit_headline_words" ||
    over === "edit_headline_chars" ||
    over === "edit_combined_words";
  const margin = layout.headline.box;

  return (
    <div
      role="group"
      aria-label={`Editing creative ${creative.n}`}
      className="@container relative aspect-[9/16] w-full overflow-hidden bg-muted font-sans"
    >
      {creative.families.map((family) => (
        <link
          key={family}
          rel="stylesheet"
          href={`https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replaceAll("%20", "+")}:wght@400;700&display=swap`}
          precedence="default"
        />
      ))}
      {creative.backgroundUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- a signed storage URL
        <img
          src={creative.backgroundUrl}
          alt=""
          className="absolute inset-0 size-full object-cover"
        />
      )}
      {layout.scrim && <Scrim scrim={layout.scrim} />}
      {layout.eyebrow && <Lines text={layout.eyebrow} />}
      <textarea
        aria-label="Headline"
        value={headline}
        rows={3}
        onChange={(event) => onHeadline(event.target.value)}
        style={{
          ...place({
            x: SAFE_BOX.x,
            y: margin.y,
            w: SAFE_BOX.w,
            h:
              Math.max(
                margin.h,
                layout.headline.size * layout.headline.lineHeight * 3,
              ) + HEADLINE_PAD,
          }),
          ...face(layout.headline.font.family, layout.headline.font.weight),
          color: layout.headline.colour,
          fontSize: cqw(layout.headline.size),
          lineHeight: layout.headline.lineHeight,
          borderColor: headlineOver ? "#ff6b6b" : "currentColor",
        }}
        className="resize-none overflow-hidden rounded-[2cqw] border-[0.6cqw] border-dashed bg-white/10 p-[1.5cqw] text-center outline-none focus-visible:ring-[0.8cqw] focus-visible:ring-ring"
      />
      {layout.badge && <Badge badge={layout.badge} />}
      {layout.logo && <Logo logo={layout.logo} url={creative.logoUrl} />}
      <div
        style={{
          ...place(layout.cta.box),
          background: layout.cta.background,
          borderRadius: cqw(layout.cta.radius),
        }}
      >
        <input
          aria-label="CTA"
          value={cta}
          onChange={(event) => onCta(event.target.value)}
          style={{
            ...face(layout.cta.font.family, layout.cta.font.weight),
            color: layout.cta.colour,
            fontSize: cqw(layout.cta.size),
            borderColor:
              over === "edit_cta_words" || over === "edit_cta_empty"
                ? "#ff6b6b"
                : "currentColor",
            borderRadius: cqw(layout.cta.radius),
          }}
          className="size-full border-[0.6cqw] border-dashed bg-transparent text-center outline-none focus-visible:ring-[0.8cqw] focus-visible:ring-ring"
        />
      </div>
    </div>
  );
}
