import "server-only";
import { z } from "zod";

const encoder = new TextEncoder();

function importKey(secret: string, usage: "sign" | "verify") {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    [usage],
  );
}

export async function signToken(payload: object, secret: string) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = await crypto.subtle.sign(
    "HMAC",
    await importKey(secret, "sign"),
    encoder.encode(body),
  );
  return `${body}.${Buffer.from(signature).toString("base64url")}`;
}

export async function verifyToken<T extends z.ZodType<{ exp: number }>>(
  token: string | undefined,
  schema: T,
  secret: string,
): Promise<z.infer<T> | null> {
  const [body, signature, ...rest] = token?.split(".") ?? [];
  if (!body || !signature || rest.length > 0) return null;

  const valid = await crypto.subtle.verify(
    "HMAC",
    await importKey(secret, "verify"),
    Buffer.from(signature, "base64url"),
    encoder.encode(body),
  );
  if (!valid) return null;

  let json: unknown;
  try {
    json = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  const parsed = schema.safeParse(json);
  return parsed.success && parsed.data.exp * 1000 >= Date.now()
    ? parsed.data
    : null;
}
