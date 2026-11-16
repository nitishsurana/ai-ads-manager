import { z } from "zod";
import type { Ai } from "@/lib/providers/ai";
import type { CostEntry } from "../photos";
import { LOAD_VERSION } from "./load";
import { CHECK_COPY_VERSION } from "./pixels";

export const LOGO_MODEL = "anthropic/claude-sonnet-5.5";

const logoCheckSchema = z.object({
  has_brand_name: z.boolean(),
  text_read: z.string(),
  is_store_brand: z.boolean(),
});

const SYSTEM = `You check a candidate logo image for an ad tool. The pink/magenta area, if any, is just transparency shown as a colour.
- has_brand_name: true if the image contains a legible brand name (a wordmark or a lockup with the name); false if it is only an icon, symbol or monogram.
- text_read: the brand text you can read, or "" if none.
- is_store_brand: true if the text matches the store name given (minor differences like "Co" vs "Company" are fine), or is a sub-brand line named in the product title (for example "King Kylie" in the title "King Kylie Matte Lip Kit" for the store "Kylie Cosmetics"); false for icons or for another company's brand (for example a payment provider's badge).`;

function promptFor(storeName: string | null, productTitle: string) {
  const title = `Product title: ${productTitle}`;
  return storeName
    ? `Store name: ${storeName}\n${title}`
    : `Store name: not known\n${title}\nSet is_store_brand to true unless the image clearly shows another brand, such as a payment provider's badge.`;
}

export type LogoVerdict = {
  iconOnly: boolean;
  storeBrand: boolean;
  textRead: string;
};

// Provider failures propagate: a model outage must not read as "this store has no logo".
export async function checkLogo(
  input: {
    sha256: string;
    image: Buffer;
    storeName: string | null;
    productTitle: string;
  },
  deps: { ai: Ai },
  costs: CostEntry[],
): Promise<LogoVerdict> {
  const { object, costUsd } = await deps.ai.generate({
    task: "logo_check",
    inputSha256: input.sha256,
    inputVersion: `${LOAD_VERSION}+${CHECK_COPY_VERSION}`,
    model: LOGO_MODEL,
    system: SYSTEM,
    prompt: promptFor(input.storeName, input.productTitle),
    image: input.image,
    schema: logoCheckSchema,
  });
  costs.push({ provider: "ai", model: LOGO_MODEL, usd: costUsd });
  return {
    iconOnly: !object.has_brand_name,
    storeBrand: object.is_store_brand,
    textRead: object.text_read,
  };
}

export const isAccepted = (verdict: LogoVerdict) =>
  !verdict.iconOnly && verdict.storeBrand;
