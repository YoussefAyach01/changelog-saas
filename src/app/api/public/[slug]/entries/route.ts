import { entriesPayload, guardRead, preflight, reply } from "@/lib/publicApi";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ slug: string }> };

export const OPTIONS = (req: Request, ctx: Ctx) => preflight(req, ctx.params);

export async function GET(req: Request, ctx: Ctx) {
  const g = await guardRead(req, ctx.params);
  if (g instanceof Response) return g;
  const raw = Number(new URL(req.url).searchParams.get("limit"));
  const limit = Number.isInteger(raw) && raw > 0 ? Math.min(raw, 50) : 10;
  return reply(entriesPayload(g.project, limit), 200, g.headers);
}
