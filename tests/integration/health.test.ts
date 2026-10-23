import { expect, it } from "vitest";
import { GET } from "@/app/api/health/route";
import { describeDb, routeParams } from "./helpers";

describeDb("GET /api/health", () => {
  it("reports complianceReady (false for the demo config) and leaks no secrets", async () => {
    const res = await GET(new Request("http://localhost:3000/api/health"), routeParams(""));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, db: true, complianceReady: false });
    expect(Object.keys(body).sort()).toEqual(["complianceReady", "db", "ok", "razorpayMode", "version"]);
    expect(JSON.stringify(body)).not.toMatch(/secret|password|postgres|rzp_|key/i);
  });
});
