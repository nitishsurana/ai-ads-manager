import type { CheerioAPI } from "cheerio";
import type { Scope } from "./section";

export const CONTROLS =
  'button, input[type="submit"], input[type="button"], a[role="button"], a[class*="btn" i], a[class*="button" i]';

// Explicit add controls only: typeless buttons in a cart form are often add-ons or "learn more".
const ADD_CONTROLS =
  'button[type="submit"], input[type="submit"], [name="add"]';

// Buttons placed outside the form but attached to it with form="<id>" still belong to it.
export function formControls($: CheerioAPI, form: Scope) {
  const formId = form.attr("id");
  const attached = formId
    ? $("button[form], input[form]")
        .toArray()
        .filter((el) => $(el).attr("form") === formId)
    : [];
  return [...form.find(CONTROLS).toArray(), ...attached];
}

export function addControls($: CheerioAPI, form: Scope) {
  return formControls($, form).filter((el) => $(el).is(ADD_CONTROLS));
}
