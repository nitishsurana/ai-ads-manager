import sharp from "sharp";

const svg = (body: string, width: number, height: number) =>
  sharp(
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${body}</svg>`,
    ),
  );

// A product on a plain white backdrop, the kind of photo the cut-out is made from.
export const plainPhoto = () =>
  svg(
    `<rect width="100%" height="100%" fill="#fff"/>
     <rect x="500" y="420" width="600" height="760" rx="70" fill="#2f6f5e"/>
     <rect x="560" y="560" width="480" height="320" rx="20" fill="#f3ead6"/>
     <circle cx="800" cy="1000" r="70" fill="#c46a3a"/>`,
    1600,
    1600,
  )
    .jpeg({ quality: 92 })
    .toBuffer();

// A lifestyle photo with the product in the lower right, so the free room is above it.
export const scenePhoto = () =>
  svg(
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
       <stop offset="0" stop-color="#9bb8c9"/><stop offset="1" stop-color="#e9d7b5"/></linearGradient></defs>
     <rect width="100%" height="100%" fill="url(#g)"/>
     <rect x="0" y="1100" width="100%" height="500" fill="#7d6244"/>
     <rect x="900" y="820" width="460" height="640" rx="50" fill="#2f6f5e"/>
     <rect x="940" y="940" width="380" height="240" rx="16" fill="#f3ead6"/>`,
    1600,
    1600,
  )
    .jpeg({ quality: 92 })
    .toBuffer();

export const darkLogo = () =>
  svg(
    `<rect width="100%" height="100%" fill="none"/>
     <text x="8" y="64" font-family="sans-serif" font-size="64" font-weight="700" fill="#222222">Acme</text>`,
    260,
    90,
  )
    .png()
    .toBuffer();

export const colourLogo = () =>
  svg(
    `<circle cx="45" cy="45" r="40" fill="#ed288c"/><rect x="100" y="20" width="150" height="50" rx="10" fill="#00afae"/>`,
    260,
    90,
  )
    .png()
    .toBuffer();
