import { NextResponse } from "next/server";
import { z } from "zod";
import { getTester } from "@/lib/auth";
import { getRoundStatus } from "@/lib/round";

export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/rounds/[id]">,
) {
  const tester = await getTester();
  if (!tester) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const status = z.uuid().safeParse(id).success
    ? await getRoundStatus(tester.userId, id)
    : null;
  return status
    ? NextResponse.json(status, { headers: { "Cache-Control": "no-store" } })
    : NextResponse.json({ error: "not found" }, { status: 404 });
}
