import sharp from "sharp";

export const png = (svg: string) => sharp(Buffer.from(svg)).png().toBuffer();
export const svgOf = (inner: string, w = 200, h = 100) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${inner}</svg>`;

// A transparent wordmark-like logo.
export const ink = (colour = "#222222") =>
  png(svgOf(`<rect x="20" y="30" width="160" height="40" fill="${colour}"/>`));
export const twoColour = () =>
  png(
    svgOf(
      '<rect x="20" y="30" width="100" height="40" fill="#222222"/><rect x="120" y="30" width="60" height="40" fill="#e0431f"/>',
    ),
  );
// A flat white box around a ring emblem whose inside is white: removing the box must leave that inside.
export const boxedEmblem = () =>
  png(
    svgOf(
      '<rect width="300" height="300" fill="#ffffff"/><circle cx="150" cy="150" r="100" fill="#ffffff" stroke="#222222" stroke-width="16"/><rect x="120" y="120" width="60" height="60" fill="#222222"/>',
      300,
      300,
    ),
  );
export const paymentBadge = () =>
  png(
    svgOf(
      '<rect width="300" height="100" fill="#ffffff"/><rect x="40" y="25" width="220" height="50" fill="#003087"/>',
      300,
      100,
    ),
  );
export const bannerPhoto = () =>
  png(
    svgOf(
      '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f4a261"/><stop offset="0.5" stop-color="#2a9d8f"/><stop offset="1" stop-color="#264653"/></linearGradient></defs><rect width="400" height="200" fill="url(#g)"/><circle cx="120" cy="100" r="50" fill="#e76f51"/><rect x="250" y="60" width="90" height="90" fill="#e9c46a"/>',
      400,
      200,
    ),
  );
export const photo = () =>
  png(
    svgOf(
      '<rect width="800" height="800" fill="#ffffff"/><rect x="200" y="200" width="400" height="400" fill="#3b6ea5"/><circle cx="400" cy="400" r="100" fill="#ffffff"/>',
      800,
      800,
    ),
  );

export const svgText = (inner: string) => Buffer.from(svgOf(inner));

// Two rings on a flat white box: a one-ink wordmark whose letter counters must come out transparent.
export const counterRings = () =>
  png(
    svgOf(
      '<rect width="300" height="100" fill="#ffffff"/><circle cx="75" cy="50" r="30" fill="#ffffff" stroke="#222222" stroke-width="16"/><circle cx="225" cy="50" r="30" fill="#ffffff" stroke="#222222" stroke-width="16"/>',
      300,
      100,
    ),
  );

// A white rounded box on transparent corners, with a small ink mark in the middle.
export const roundedBox = () =>
  png(
    svgOf(
      '<rect width="200" height="100" rx="30" fill="#ffffff"/><rect x="80" y="20" width="40" height="60" fill="#222222"/>',
    ),
  );

// An svg with a full-bleed white background: opaque, so not a transparent logo.
export const svgWithBackground = () =>
  Buffer.from(
    svgOf(
      '<rect width="200" height="100" fill="#ffffff"/><rect x="20" y="30" width="160" height="40" fill="#222222"/>',
    ),
  );

// Hostile constructs around a rect that must still render: plain and namespace-prefixed scripts and foreignObject, a handler, an external image, @import, DOCTYPE and links. Nothing is stored, and rendering must not reach outside.
export const hostileSvg = () =>
  Buffer.from(
    `<?xml version="1.0"?><!DOCTYPE svg [<!ENTITY x "y">]><svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:s="http://www.w3.org/2000/svg" xmlns:h="http://www.w3.org/1999/xhtml" width="200" height="100" viewBox="0 0 200 100" onload="alert(1)"><style>@import url(https://evil.example/x.css); .a{fill:#222222}</style><script>alert(2)</script><s:script>alert(3)</s:script><h:script>alert(4)</h:script><foreignObject width="10" height="10"><div xmlns="http://www.w3.org/1999/xhtml">hi</div></foreignObject><s:foreignObject width="10" height="10"/><s:set attributeName="href" to="https://evil.example/"/><image href="https://evil.example/tracker.png" width="1" height="1"/><a xlink:href="javascript:alert(5)"><rect class="a" x="20" y="30" width="160" height="40" fill="#222222" onclick="alert(6)" style="fill:url(https://evil.example/p.svg#x)"/></a></svg>`,
  );

// Paint values that are property names on a plain object: they must read as unknown colours, not crash.
export const lookalikeColoursSvg = () =>
  Buffer.from(
    svgOf(
      '<defs><rect width="1" height="1" fill="constructor"/><rect width="1" height="1" fill="__proto__"/></defs><rect x="20" y="30" width="160" height="40" fill="#222222"/>',
    ),
  );

// A black wordmark of two rings with a small red dot (under 4% of the ink) between them.
export const ringsWithDot = () =>
  png(
    svgOf(
      '<rect width="300" height="100" fill="#ffffff"/><circle cx="75" cy="50" r="30" fill="#ffffff" stroke="#111111" stroke-width="16"/><circle cx="225" cy="50" r="30" fill="#ffffff" stroke="#111111" stroke-width="16"/><circle cx="150" cy="50" r="6" fill="#e0201f"/>',
      300,
      100,
    ),
  );

// Fills come only from classes in a stylesheet that also holds an @import: the colours must survive the strip.
export const classStyledSvg = () =>
  Buffer.from(
    svgOf(
      '<style>@import url(https://evil.example/x.css); .a{fill:#e11111} .b{fill:#1111ee}</style><rect class="a" x="20" y="30" width="90" height="40"/><rect class="b" x="110" y="30" width="70" height="40"/>',
    ),
  );

// A 24-unit viewBox: rendered at its own size it would be a speck; it must come out 1200 px wide.
export const tinySvg = () =>
  Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><rect x="0" y="7" width="24" height="10" fill="#222222"/></svg>',
  );
