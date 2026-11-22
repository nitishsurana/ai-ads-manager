import { filterRounds, loadAdmin, parseFilters, toCsv } from "@/lib/admin";
import { isAdmin } from "@/lib/auth";

export async function GET(request: Request) {
  if (!(await isAdmin())) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const filters = parseFilters(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  const rounds = filterRounds((await loadAdmin()).rounds, filters, new Date());

  return new Response(toCsv(rounds), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="ai-ads-manager-rounds.csv"',
      "Cache-Control": "no-store",
    },
  });
}
