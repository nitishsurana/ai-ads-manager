import { messages } from "@/lib/messages";
import type { BriefSettings } from "./schema";

// The settings that differ from the defaults, as one line; empty when none do.
export function settingsText(settings: BriefSettings) {
  return [
    settings.productSize === "smaller" && messages.setting_smaller,
    settings.preferCutout && messages.setting_cutout,
    settings.backgroundStyle === "plain" && messages.setting_plain,
    settings.backgroundStyle === "scene" && messages.setting_scene,
  ]
    .filter((part) => part !== false)
    .join(" · ");
}
