// GET /api/menu: the live menu plus whether the restaurant is taking orders.
// Never cached, so admin changes show up on the next poll (within 15 seconds).
import { route } from "@/lib/http";
import { getPublicMenu } from "@/server/menu";

export const dynamic = "force-dynamic";

export const GET = route("menu.get", async () => Response.json(await getPublicMenu()));
