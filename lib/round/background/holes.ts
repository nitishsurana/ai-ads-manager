const SOLID = 10;

export const neighbours = (i: number, width: number, height: number) => {
  const x = i % width;
  const out: number[] = [];
  if (x > 0) out.push(i - 1);
  if (x < width - 1) out.push(i + 1);
  if (i >= width) out.push(i - width);
  if (i < width * (height - 1)) out.push(i + width);
  return out;
};

// Gaps inside the product that are not connected to the outside and cover at most `maxShare` of its area are specks BiRefNet left in glossy edges; they become opaque. A larger gap (the loop of a handle) is a real opening and stays.
export function fillSmallHoles(
  alpha: Uint8Array,
  width: number,
  height: number,
  maxShare: number,
) {
  const out = Uint8Array.from(alpha);
  const solid = (i: number) => (alpha[i] ?? 0) > SOLID;
  let area = 0;
  for (let i = 0; i < alpha.length; i++) if (solid(i)) area++;

  const seen = new Uint8Array(alpha.length);
  const visit = (start: number) => {
    const cells = [start];
    seen[start] = 1;
    let touchesEdge = false;
    for (let at = 0; at < cells.length; at++) {
      const i = cells[at] ?? 0;
      const x = i % width;
      const y = Math.floor(i / width);
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
        touchesEdge = true;
      }
      for (const n of neighbours(i, width, height)) {
        if (!seen[n] && !solid(n)) {
          seen[n] = 1;
          cells.push(n);
        }
      }
    }
    return { cells, touchesEdge };
  };

  for (let start = 0; start < alpha.length; start++) {
    if (seen[start] || solid(start)) continue;
    const { cells, touchesEdge } = visit(start);
    if (!touchesEdge && cells.length <= area * maxShare) {
      for (const i of cells) out[i] = 255;
    }
  }
  return out;
}
