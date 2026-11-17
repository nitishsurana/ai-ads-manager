import { NextResponse } from "next/server";
import { cronAuthorized, keepAlive } from "@/lib/housekeeping";

export async function GET(request: Request) {
  if (!cronAuthorized(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await keepAlive(), {
    headers: { "Cache-Control": "no-store" },
  });
}
