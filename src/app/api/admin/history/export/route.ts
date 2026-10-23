// GET /api/admin/history/export?from=YYYY-MM-DD&to=YYYY-MM-DD&q=...  -> CSV download
import { adminRoute } from "@/server/admin/guard";
import { historyCsv, historyQuerySchema } from "@/server/admin/history";

export const dynamic = "force-dynamic";

export const GET = adminRoute("admin.history.export", async (request) => {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const query = historyQuerySchema.parse(params);
  const csv = await historyCsv(query);
  const name = `orders-${query.from ?? "today"}${query.to ? "-to-" + query.to : ""}.csv`;
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${name}"`,
    },
  });
});
