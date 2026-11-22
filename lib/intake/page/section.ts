import type { Cheerio, CheerioAPI } from "cheerio";
import type { AnyNode } from "domhandler";
import type { ShopifyProduct } from "../product";
import { addControls } from "./controls";
import { normalise } from "./text";

export type Node = AnyNode;
export type Scope = Cheerio<Node>;

// Only for pages whose product section couldn't be pinned down: inside a real section these tags can wrap the price and rating.
const SITE_CHROME = "header, footer, nav";

const SECTION_WRAPPER = '[id^="shopify-section"]';

export const HIDDEN = [
  "script",
  "style",
  "noscript",
  "template",
  "dialog",
  "[role=dialog]",
  "[hidden]",
  '[style*="display:none"]',
  '[style*="display: none"]',
].join(",");

// Cart drawers, recommendation rails, banners and payment-plan widgets that can sit inside a section but never describe this product.
export const CLUTTER = [
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

export const NOISE = `${HIDDEN},${CLUTTER}`;

export function variantIdsOf(product: Pick<ShopifyProduct, "variants">) {
  return new Set(product.variants.map((v) => String(v.id)));
}

function formHasVariant($: CheerioAPI, form: Node, variantIds: Set<string>) {
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
}

export function variantForms($: CheerioAPI, variantIds: Set<string>) {
  return $('form[action*="/cart/add"]')
    .toArray()
    .filter((form) => formHasVariant($, form, variantIds));
}

function scopeOf($: CheerioAPI, anchor: Node): Scope {
  const wrapper = $(anchor).closest(SECTION_WRAPPER);
  return wrapper.length ? wrapper : $(anchor).closest("section, main");
}

// Dawn renders a payment-plan form for the same variant before the real one, so within the first match's scope a form outside any clutter wins.
function cartFormOf($: CheerioAPI, matching: Node[]) {
  const first = matching[0];
  if (!first) return undefined;
  const root = scopeOf($, first).get(0);
  if (!root) return first;
  const clean = matching.find(
    (form) =>
      $.contains(root, form) &&
      !$(form).is(CLUTTER) &&
      !$(form)
        .parents(CLUTTER)
        .toArray()
        .some((ancestor) => $.contains(root, ancestor)),
  );
  return clean ?? first;
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
  const variantIds = variantIdsOf(product);
  const productForms = variantForms($, variantIds);
  const form = cartFormOf($, productForms);
  const anchor = form ?? headingOf($, product.title);
  const scope: Scope = anchor ? scopeOf($, anchor) : $("main").first();
  const section = scope.length > 0 ? scope : $("body");
  // A store's own add button can carry a script hook that reads like clutter (Glossier's js-can-trigger-upsell), so it is never stripped.
  const ownAdd = new Set<Node>(
    productForms.flatMap((f) => addControls($, $(f))),
  );
  section.find(HIDDEN).remove();
  section
    .find(CLUTTER)
    .filter((_, el) => !ownAdd.has(el))
    .remove();
  if (section.is("body, main")) section.find(SITE_CHROME).remove();
  return { section, form: form ? $(form) : null };
}
