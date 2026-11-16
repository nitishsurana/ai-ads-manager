import type { z } from "zod";
import type { pageStylesSchema } from "./schemas";

export type PageStyles = z.infer<typeof pageStylesSchema>;

export type ScrapeOptions = {
  country: string;
  // Review and quiz widgets hydrate late; plain documents such as product JSON skip the wait.
  waitForWidgets: boolean;
  // Adds the style capture to the same request (no extra credit); variantIds picks this product's cart form.
  captureStyles?: { variantIds: string[] };
};

export type FirecrawlPage = {
  status: number;
  html: string;
  location: string;
  // null when not asked for, or when the capture didn't return usable JSON.
  styles: PageStyles | null;
};

export type Firecrawl = {
  scrapePage(url: string, options: ScrapeOptions): Promise<FirecrawlPage>;
};
