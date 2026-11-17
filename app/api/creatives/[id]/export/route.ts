import { NextResponse } from "next/server";
import { z } from "zod";
import { getTester } from "@/lib/auth";
import { exportCreative } from "@/lib/round";

export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/creatives/[id]/export">,
) {
  const tester = await getTester();
  if (!tester) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const result = await exportCreative(tester.userId, id).catch(
    (error: unknown) => {
      console.error(`creative ${id}: export failed`, error);
      return null;
    },
  );
  if (!result) {
    return NextResponse.json({ error: "export failed" }, { status: 500 });
  }
  return result.ok
    ? NextResponse.json(
        { url: result.url, fileName: result.fileName },
        { headers: { "Cache-Control": "no-store" } },
      )
    : NextResponse.json({ error: "not found" }, { status: 404 });
}
