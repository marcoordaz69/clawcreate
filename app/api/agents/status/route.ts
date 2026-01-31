import { NextResponse } from "next/server";
import { authenticateAgent } from "@/lib/auth";

export async function GET(request: Request) {
  const auth = await authenticateAgent(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  return NextResponse.json({
    status: auth.agent.status,
    claimed_at: auth.agent.claimed_at,
  });
}
