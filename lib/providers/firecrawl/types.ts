export type ScrapeOptions = {
  country: string;
  // Review and quiz widgets hydrate late; plain documents such as product JSON skip the wait.
  waitForWidgets: boolean;
};

export type FirecrawlPage = {
  status: number;
  html: string;
  location: string;
};

export type Firecrawl = {
  scrapePage(url: string, options: ScrapeOptions): Promise<FirecrawlPage>;
};
