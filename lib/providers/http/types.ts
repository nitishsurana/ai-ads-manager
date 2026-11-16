export type HttpGetOptions = {
  maxBytes?: number;
};

export type HttpResponse = {
  status: number;
  headers: Record<string, string>;
  location: string | null;
  body: Buffer;
  truncated: boolean;
};

export type HttpFailure = "dns" | "blocked" | "timeout" | "network";

export type HttpResult =
  { ok: true; response: HttpResponse } | { ok: false; reason: HttpFailure };

export type Http = {
  get(url: string, options?: HttpGetOptions): Promise<HttpResult>;
};

export type FollowResult =
  | { ok: true; finalUrl: string; response: HttpResponse }
  | { ok: false; reason: HttpFailure | "too_many_redirects" };
