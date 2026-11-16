import type { Step1FailureCode } from "@/lib/messages";
import type { Http } from "@/lib/providers/http";
import type { ShopifyProduct } from "./product";

export type Market = "US" | "CA" | "GB" | "AU" | "IN" | "DE" | "FR";

export type IntakeDeps = {
  http: Http;
  findWorkspace(productKey: string): Promise<string | null>;
};

export type IntakeFailure = { ok: false; code: Step1FailureCode };

export type IntakeResult = {
  url: string;
  finalUrl: string;
  productKey: string;
  market: Market;
  product: ShopifyProduct;
};

export type IntakeOutcome =
  | IntakeFailure
  | { ok: true; existingWorkspaceId: string }
  | { ok: true; result: IntakeResult };
