import type { Cheerio, CheerioAPI } from "cheerio";
import type { AnyNode } from "domhandler";
import type { ShopifyProduct } from "../product";
import { normalise } from "./text";

export type Node = AnyNode;
export type Scope = Cheerio<Node>;

// Only for pages whose product section couldn't be pinned down: inside a real section these tags can wrap the price and rating.
const SITE_CHROME = "header, footer, nav";

const SECTION_WRAPPER = '[id^="shopify-section"]';

// Cart drawers, recommendation rails, banners and page chrome that can sit inside a section but never describe this product.
export const NOISE = [
  "script",
  "style",
  "noscript",
  "template",
  "dialog",
  "[role=dialog]",
  "[hidden]",
  '[style*="display:none"]',
  '[style*="display: none"]',
  "cart-drawer",
  '[id*="cart-drawer" i]',
  '[class*="cart-drawer" i]',
  '[class*="CartDrawer"]',
  "product-recommendations",
  '[class*="recommend" i]',
  '[class*="related" i]',
  '[class*="upsell" i]',
  '[class*="addon" i]',
  '[class*="add-on" i]',
  '[class*="announcement" i]',
  '[class*="afterpay" i]',
  '[class*="klarna" i]',
  '[class*="installment" i]',
  '[class*="sezzle" i]',
  '[class*="affirm" i]',
].join(",");

function cartFormOf($: CheerioAPI, variantIds: Set<string>) {
  const forms = $('form[action*="/cart/add"]').toArray();
  return forms.find((form) => {
    const formId = $(form).attr("id");
    const fields = $(form).find('[name="id"]').toArray();
    if (formId) {
      const attached = $('[name="id"][form]').filter(
        (_, el) => $(el).attr("form") === formId,
      );
      fields.push(...attached.toArray());
    }
    return fields.some((field) => {
      const values = [
        $(field).attr("value"),
        ...$(field)
          .find("option")
          .toArray()
          .map((option) => $(option).attr("value")),
      ];
      return values.some((value) => value && variantIds.has(value));
    });
  });
}

function headingOf($: CheerioAPI, title: string) {
  const wanted = normalise(title);
  const headings = $("h1").toArray();
  return headings.find((h) => {
    const text = normalise($(h).text());
    return text !== "" && (wanted.includes(text) || text.includes(wanted));
  });
}

// The cart form for this product's variants is the anchor; pages without one (find in store, quote) fall back to the title heading.
export type MainSection = { section: Scope; form: Scope | null };

export function mainSection(
  $: CheerioAPI,
  product: Pick<ShopifyProduct, "title" | "variants">,
): MainSection {
  const variantIds = new Set(product.variants.map((v) => String(v.id)));
  const form = cartFormOf($, variantIds);
  const anchor = form ?? headingOf($, product.title);
  const wrapper = anchor && $(anchor).closest(SECTION_WRAPPER);
  const scope: Scope = anchor
    ? wrapper?.length
      ? wrapper
      : $(anchor).closest("section, main")
    : $("main").first();
  const section = scope.length > 0 ? scope : $("body");
  section.find(NOISE).remove();
  if (section.is("body, main")) section.find(SITE_CHROME).remove();
  return { section, form: form ? $(form) : null };
}
