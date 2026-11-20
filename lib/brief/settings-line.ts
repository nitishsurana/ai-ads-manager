import { messages } from "@/lib/messages";
import type { BriefSettings } from "./schema";

// The settings that differ from the defaults, as one line; empty when none do.
export function settingsText(settings: BriefSettings) {
  return [
    settings.productSize === "smaller" && messages.setting_smaller,
    settings.preferCutout && messages.setting_cutout,
    settings.backgroundStyle === "plain" && messages.setting_plain,
    settings.backgroundStyle === "scene" && messages.setting_scene,
    settings.ctaColour === "brand" && messages.setting_cta_brand,
    settings.ctaColour === "dark" && messages.setting_cta_dark,
    settings.ctaColour === "light" && messages.setting_cta_light,
  ]
    .filter((part) => part !== false)
    .join(" · ");
}

// What the tester asked for that code alone decides, as one line; empty when there is none.
export const notAppliedText = (items: string[]) =>
  items.length > 0 ? `${messages.not_applied_prefix} ${items.join(" · ")}` : "";
