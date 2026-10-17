import { dbHealth } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    status: "ok",
    database: await dbHealth(),
    ai: process.env.GEMINI_API_KEY ? "gemini" : "fallback",
  });
}
