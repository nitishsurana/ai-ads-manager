import type { Logo } from "./types";

export function wordmark(
  storeName: string,
  headerBackground: string | null,
): Logo {
  return {
    source: "wordmark",
    pngPath: null,
    width: null,
    height: null,
    sourceUrl: null,
    text: storeName,
    textRead: null,
    colourClass: null,
    colours: [],
    transparent: true,
    headerBackground,
    iconOnly: false,
    storeBrand: true,
  };
}
