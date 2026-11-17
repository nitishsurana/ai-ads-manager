import type { BrandKit, Logo } from "@/lib/intake";

type LogoPreviewProps = {
  logo: Logo | null;
  url: string | null;
  // The typed brand name; with no logo it becomes a text wordmark.
  typedName: string;
  kit: BrandKit;
};

export function LogoPreview({ logo, url, typedName, kit }: LogoPreviewProps) {
  const wordmark = logo ? logo.text : typedName;
  if (!url && !wordmark) return null;
  const font = `"${kit.fonts.heading.family}", serif`;

  return (
    <div>
      <span className="mb-1.5 block text-[13px] font-medium">Logo</span>
      <div className="grid grid-cols-2 gap-2">
        {[
          ["bg-white", kit.palette.text ?? "#18181b"],
          ["bg-zinc-900", kit.palette.background ?? "#fafafa"],
        ].map(([surface, ink], index) => (
          <div
            key={surface}
            className={`flex h-22 items-center justify-center gap-2 rounded-[10px] border border-border ${surface}`}
          >
            {url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={url}
                alt={index === 0 ? "Store logo" : ""}
                className="max-h-16 max-w-[80%] object-contain"
              />
            ) : (
              <span
                className="text-2xl font-bold"
                style={{ color: ink, fontFamily: font }}
              >
                {wordmark}
              </span>
            )}
          </div>
        ))}
      </div>
      <p className="m-0 mt-1.5 text-xs text-muted-foreground">
        On light and on dark
      </p>
    </div>
  );
}
