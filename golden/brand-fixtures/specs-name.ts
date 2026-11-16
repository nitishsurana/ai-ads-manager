import { homeLink, org, site } from "./html";
import { accepted, IMAGES, type Spec } from "./spec";
import { ink } from "./images";

const title = (extra: string) => `<title>Blue Mug</title>${extra}`;

// The store name in its order, and the "My Store" and missing cases.
export async function nameSpecs(): Promise<Spec[]> {
  const ink1 = await ink();

  return [
    {
      // "My Store" is unusable, so og:site_name decides; a bare myshopify subdomain counts as missing too.
      name: "brand-name-site-name",
      host: "shopabc.myshopify.com",
      head: title(`${org({ name: "shopabc" })}${site("Real Brand")}`),
      header: `<header>${homeLink("My Store")}</header>`,
      storefront: null,
      verdicts: [],
    },
    {
      // Neither structured data nor og:site_name gives a name: the header text does.
      name: "brand-name-header-text",
      host: "shopabc.myshopify.com",
      head: title(
        `${org({ name: "shopabc.myshopify.com" })}${site("My Store")}`,
      ),
      header: `<header>${homeLink("Header Brand", 'class="header__heading-link"')}</header>`,
      storefront: null,
      verdicts: [],
    },
    {
      // An announcement bar that links home is not the store's name.
      name: "brand-name-announcement-bar",
      head: title(site("")),
      header: `<div class="announcement-bar">${homeLink("Free shipping over $50")}</div><header><a href="/cart">Cart</a></header>`,
      storefront: null,
      verdicts: [],
    },
    {
      // Nothing usable anywhere: the brand-name prompt shows and there is no logo.
      name: "brand-name-missing",
      head: title(`${org({ name: "My Store" })}${site("")}`),
      header: `<header>${homeLink("My Store")}</header>`,
      storefront: null,
      verdicts: [],
    },
    {
      // A real logo with the default "My Store" name: the logo stays and only the name prompt shows.
      name: "brand-logo-with-default-name",
      head: title(`${org({ name: "My Store" })}${site("My Store")}`),
      header: `<header>${homeLink(`<img src="${IMAGES}/logo.png" alt="My Store">`)}</header>`,
      files: { "logo.png": ink1 },
      storefront: null,
      verdicts: [accepted("Real Mark")],
    },
    {
      // Only the logo's alt text names the store.
      name: "brand-name-from-alt",
      header: `<header>${homeLink(`<img src="${IMAGES}/logo.png" alt="Alt Goods logo">`)}</header>`,
      files: { "logo.png": ink1 },
      verdicts: [accepted("Alt Goods")],
    },
  ];
}
