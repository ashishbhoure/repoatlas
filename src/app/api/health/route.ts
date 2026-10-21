import { connection } from "next/server";
import { db } from "@/lib/database/prisma";

/** Liveness/readiness probe for deployments: checks the database connection only. */
export async function GET() {
  await connection();
  try {
    await db().$queryRaw`SELECT 1`;
    return Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ status: "degraded", database: "unreachable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
