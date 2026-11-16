export function squash(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

export function normalise(text: string) {
  return squash(text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " "));
}

type TextNode = {
  type: string;
  data?: string;
  children?: TextNode[];
};

// Children are joined with spaces so "4.5" and "(73)" in sibling spans don't fuse into "4.5(73)".
export function textOf(node: TextNode): string {
  const parts: string[] = [];
  const walk = (current: TextNode) => {
    if (current.type === "text") parts.push(current.data ?? "");
    else if (current.type !== "comment") current.children?.forEach(walk);
  };
  walk(node);
  return squash(parts.join(" "));
}
