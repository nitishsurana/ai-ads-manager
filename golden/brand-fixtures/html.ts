import { IMAGES } from "./spec";

export const homeLink = (inner: string, attrs = "") =>
  `<a href="/" ${attrs}>${inner}</a>`;

export const ogHead = (extra: string) => `<title>Home</title>${extra}`;
export const og = (name: string) =>
  `<meta property="og:image" content="${IMAGES}/${name}">`;
export const site = (name: string) =>
  `<meta property="og:site_name" content="${name}">`;
export const org = (data: object) =>
  `<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@type": "Organization", ...data })}</script>`;
