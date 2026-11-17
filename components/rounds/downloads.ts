import { z } from "zod";

const exportSchema = z.object({ url: z.url(), fileName: z.string() });

type Export = z.infer<typeof exportSchema>;

// The server draws the full-size PNG and answers with a signed URL that downloads under the creative's file name.
async function requestExport(creativeId: string): Promise<Export> {
  const response = await fetch(`/api/creatives/${creativeId}/export`);
  if (!response.ok) throw new Error(`export ${creativeId}: ${response.status}`);
  return exportSchema.parse(await response.json());
}

function save(href: string, fileName: string) {
  const link = document.createElement("a");
  link.href = href;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
}

export async function downloadPng(creativeId: string) {
  const { url, fileName } = await requestExport(creativeId);
  save(url, fileName);
}

// "store-product-r2-c1.png" files make "store-product-r2.zip".
const zipName = (fileName: string) =>
  fileName.replace(/-c\d+(-[A-Z]{3})?\.png$/, ".zip");

// Built here from the same signed URLs, so the server never holds the whole round.
export async function downloadZip(creativeIds: string[]) {
  const [{ default: JSZip }, exports] = await Promise.all([
    import("jszip"),
    Promise.all(creativeIds.map(requestExport)),
  ]);
  const files = await Promise.all(
    exports.map(async ({ url, fileName }) => {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`zip: ${fileName}: ${response.status}`);
      return { fileName, blob: await response.blob() };
    }),
  );
  const zip = new JSZip();
  for (const { fileName, blob } of files) zip.file(fileName, blob);
  const href = URL.createObjectURL(await zip.generateAsync({ type: "blob" }));
  save(href, zipName(files[0]?.fileName ?? "creatives.png"));
  setTimeout(() => URL.revokeObjectURL(href), 10_000);
}
