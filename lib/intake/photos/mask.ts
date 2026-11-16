import sharp from "sharp";

const ANALYSIS_SIDE = 256;
const THRESHOLD = 128;
// A main shape is at least this share of the largest shape; smaller pieces (text bits, specks) are noise.
const MAIN_SHARE_OF_LARGEST = 0.1;
// ...and at least this share of the frame, so a mask of only specks has no main shape.
const MAIN_SHARE_OF_FRAME = 0.005;

async function binaryMask(mask: Buffer) {
  const { data, info } = await sharp(mask)
    .flatten({ background: "#000000" })
    .greyscale()
    .resize(ANALYSIS_SIDE, ANALYSIS_SIDE, { fit: "inside" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const cells = Uint8Array.from(data, (v) => (v >= THRESHOLD ? 1 : 0));
  return { cells, width: info.width, height: info.height };
}

function neighbours(
  i: number,
  width: number,
  height: number,
  diagonal: boolean,
) {
  const x = i % width;
  const y = Math.floor(i / width);
  const out: number[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if ((dx === 0 && dy === 0) || (!diagonal && dx !== 0 && dy !== 0))
        continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < width && ny < height)
        out.push(ny * width + nx);
    }
  }
  return out;
}

// Background cells reachable from the border stay background; any other cell is product, so holes inside a shape fill.
function fillHoles(cells: Uint8Array, width: number, height: number) {
  const outside = new Uint8Array(cells.length);
  const stack: number[] = [];
  const seed = (i: number) => {
    if (cells[i] === 0 && !outside[i]) {
      outside[i] = 1;
      stack.push(i);
    }
  };
  for (let x = 0; x < width; x++) {
    seed(x);
    seed((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    seed(y * width);
    seed(y * width + width - 1);
  }
  for (let i = stack.pop(); i !== undefined; i = stack.pop()) {
    for (const n of neighbours(i, width, height, false)) seed(n);
  }
  return Uint8Array.from(outside, (v) => (v ? 0 : 1));
}

function componentAreas(cells: Uint8Array, width: number, height: number) {
  const seen = new Uint8Array(cells.length);
  const areas: number[] = [];
  for (let start = 0; start < cells.length; start++) {
    if (!cells[start] || seen[start]) continue;
    let area = 0;
    const stack = [start];
    seen[start] = 1;
    for (let i = stack.pop(); i !== undefined; i = stack.pop()) {
      area++;
      for (const n of neighbours(i, width, height, true)) {
        if (cells[n] && !seen[n]) {
          seen[n] = 1;
          stack.push(n);
        }
      }
    }
    areas.push(area);
  }
  return areas;
}

export async function countMainShapes(mask: Buffer) {
  const { cells, width, height } = await binaryMask(mask);
  const areas = componentAreas(fillHoles(cells, width, height), width, height);
  const largest = Math.max(0, ...areas);
  const minimum = Math.max(
    largest * MAIN_SHARE_OF_LARGEST,
    width * height * MAIN_SHARE_OF_FRAME,
  );
  return areas.filter((area) => area >= minimum).length;
}
