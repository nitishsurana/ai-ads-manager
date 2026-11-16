// Runs inside the rendered page (a Firecrawl executeJavascript action) and returns the computed look of the elements that carry a brand's colours and fonts, as JSON. Reading `body` alone gives browser defaults on themes that style wrappers instead.
export function captureStylesScript(variantIds: string[]) {
  return `(() => {
  const ids = ${JSON.stringify(variantIds)};
  const visible = (el) => el && el.offsetParent !== null && el.getBoundingClientRect().height > 0;
  const css = (el) => getComputedStyle(el);
  const paint = (value) => (/^rgba?\\(.*,\\s*0\\)$/.test(value) || value === "transparent" ? null : value);
  const solidBackground = (el) => {
    for (let node = el; node; node = node.parentElement) {
      const colour = paint(css(node).backgroundColor);
      if (colour) return colour;
    }
    return null;
  };
  const form = [...document.querySelectorAll('form[action*="/cart/add"]')].find((f) =>
    [...f.querySelectorAll('[name="id"]')].some((i) => ids.includes(i.value) || [...i.querySelectorAll("option")].some((o) => ids.includes(o.value))),
  );
  const button = form && [...form.querySelectorAll('button[type="submit"], button[name="add"], input[type="submit"]')].find(visible);
  const scope = (form && form.closest('[id^="shopify-section"], main')) || document;
  const title = [...scope.querySelectorAll("h1")].find(visible) || [...document.querySelectorAll("h1")].find(visible);
  const header = [...document.querySelectorAll('header, [role="banner"]')].find(visible);
  const paragraph = [...document.querySelectorAll("main p")].find(visible) || document.body;
  const link = [...document.querySelectorAll("main a[href]")].find(visible);
  return JSON.stringify({
    button: button ? { background: paint(css(button).backgroundColor), color: css(button).color, fontFamily: css(button).fontFamily } : null,
    header: header ? { background: solidBackground(header) } : null,
    title: title ? { color: css(title).color, fontFamily: css(title).fontFamily } : null,
    body: { color: css(paragraph).color, fontFamily: css(paragraph).fontFamily, background: solidBackground(title || document.body) },
    link: link ? { color: css(link).color } : null,
  });
})()`;
}
