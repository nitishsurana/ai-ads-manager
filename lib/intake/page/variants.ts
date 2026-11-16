import type { CheerioAPI } from "cheerio";
import type { ShopifyProduct } from "../product";
import type { Node, Scope } from "./section";
import { normalise, textOf } from "./text";
import type { PageVariant, VariantAvailability } from "./types";

type Control = { label: string; disabled: boolean };
type ProductVariants = Pick<ShopifyProduct, "variants" | "options">;

const OPTION_CONTROLS =
  'button, label, option, [role="radio"], [role="option"], input[type="radio"]';
const UNAVAILABLE_TEXT = /sold out|unavailable|out of stock/i;
const UNAVAILABLE_CLASS =
  /(?:^|[-_])(?:disabled|sold-?out|unavailable|out-?of-?stock)$/i;

function isDisabled($: CheerioAPI, el: Node) {
  const node = $(el);
  const classes = (node.attr("class") ?? "").split(/\s+/);
  return (
    node.is("[disabled]") ||
    node.attr("aria-disabled") === "true" ||
    classes.some((c) => UNAVAILABLE_CLASS.test(c))
  );
}

function labelOf($: CheerioAPI, el: Node) {
  const node = $(el);
  const own = node.attr("aria-label") ?? node.attr("value") ?? textOf(el);
  return normalise(own);
}

// A radio input has no text of its own: its label (and the label's classes) carry the name and the sold-out state.
function controlOf($: CheerioAPI, el: Node): Control {
  const node = $(el);
  if (!node.is('input[type="radio"]')) {
    return {
      label: labelOf($, el),
      disabled: isDisabled($, el) || UNAVAILABLE_TEXT.test(textOf(el)),
    };
  }
  const id = node.attr("id");
  const label = id
    ? $("label[for]")
        .filter((_, l) => $(l).attr("for") === id)
        .first()
    : node.closest("label");
  return {
    label: normalise(node.attr("value") ?? label.text()),
    disabled:
      isDisabled($, el) || label.toArray().some((l) => isDisabled($, l)),
  };
}

function controlsIn($: CheerioAPI, section: Scope) {
  return section
    .find(OPTION_CONTROLS)
    .toArray()
    .map((el) => controlOf($, el))
    .filter((c) => c.label !== "");
}

function matches(label: string, value: string, optionName: string) {
  if (label === value) return true;
  const named =
    label.startsWith(`${optionName} `) || /^(select|choose|pick) /.test(label);
  return named && label.endsWith(` ${value}`);
}

function stateOfOptions(
  controls: Control[],
  values: string[],
  names: string[],
): VariantAvailability {
  const states = values.map((value, i) => {
    const found = controls.filter((c) =>
      matches(c.label, normalise(value), normalise(names[i] ?? "")),
    );
    if (found.length === 0) return "unknown";
    return found.some((c) => c.disabled) ? "unavailable" : "buyable";
  });
  if (states.includes("unavailable")) return "unavailable";
  return states.length > 0 && states.every((s) => s === "buyable")
    ? "buyable"
    : "unknown";
}

// A cart form's variant select lists every variant by id, with sold-out ones disabled or labelled.
function stateInSelect($: CheerioAPI, section: Scope, id: number) {
  const option = section
    .find(`select[name="id"] option[value="${id}"]`)
    .first();
  if (option.length === 0) return "unknown";
  const text = textOf(option[0] as Node);
  return isDisabled($, option[0] as Node) || UNAVAILABLE_TEXT.test(text)
    ? "unavailable"
    : "buyable";
}

export function variantAvailability(
  $: CheerioAPI,
  section: Scope,
  product: ProductVariants,
): PageVariant[] {
  const controls = controlsIn($, section);
  const names = product.options.map((o) => o.name);
  return product.variants.map((variant) => {
    const states = [
      stateInSelect($, section, variant.id),
      stateOfOptions(controls, variant.options, names),
    ];
    const availability: VariantAvailability = states.includes("unavailable")
      ? "unavailable"
      : states.includes("buyable")
        ? "buyable"
        : "unknown";
    return { id: variant.id, availability };
  });
}
