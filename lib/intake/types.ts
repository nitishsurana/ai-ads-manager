import type { Step1FailureCode } from "@/lib/messages";
import type { Ai } from "@/lib/providers/ai";
import type { Fal } from "@/lib/providers/fal";
import type { Firecrawl } from "@/lib/providers/firecrawl";
import type { Http } from "@/lib/providers/http";
import type { Storage } from "@/lib/providers/storage";
import type { PageStyles } from "@/lib/providers/firecrawl";
import type { BrandResult } from "./brand";
import type { PageFacts } from "./page";
import type { PhotosProgress, PhotosResult } from "./photos";
import type { ShopifyProduct } from "./product";

export type Market = "US" | "CA" | "GB" | "AU" | "IN" | "DE" | "FR";

export type IntakeDeps = {
  http: Http;
  firecrawl: Firecrawl;
  ai: Ai;
  fal: Fal;
  storage: Storage;
  progress(event: IntakeProgress): void | Promise<void>;
  findWorkspace(productKey: string): Promise<string | null>;
};

export type IntakeProgress = PhotosProgress;

export type IntakeFailure = { ok: false; code: Step1FailureCode };

export type IntakeWarning = "not_purchasable";

export type IntakeResult = {
  url: string;
  finalUrl: string;
  productKey: string;
  market: Market;
  product: ShopifyProduct;
  page: PageFacts;
  photos: PhotosResult;
  brand: BrandResult;
  warnings: IntakeWarning[];
};

export type IntakeOutcome =
  | IntakeFailure
  | { ok: true; existingWorkspaceId: string }
  | { ok: true; result: IntakeResult };

export type UntilBrandOutcome =
  | IntakeFailure
  | { ok: true; existingWorkspaceId: string }
  | {
      ok: true;
      result: Omit<IntakeResult, "brand">;
      // The rendered product page, which the brand stage reads colours, fonts and the header logo from.
      productPage: { url: string; html: string; styles: PageStyles | null };
    };
