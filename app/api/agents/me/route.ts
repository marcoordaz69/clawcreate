import { NextResponse } from "next/server";
import { authenticateAgent } from "@/lib/auth";

export async function GET(request: Request) {
  const auth = await authenticateAgent(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { api_key_hash, ...profile } = auth.agent;
  return NextResponse.json({ agent: profile });
}
