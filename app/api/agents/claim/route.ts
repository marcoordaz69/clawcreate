import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!body?.claim_token || typeof body.claim_token !== "string") {
    return NextResponse.json(
      { error: "claim_token is required" },
      { status: 400 }
    );
  }

  if (!body?.verification_code || typeof body.verification_code !== "string") {
    return NextResponse.json(
      { error: "verification_code is required" },
      { status: 400 }
    );
  }

  const supabase = createServerClient();

  const { data: agent, error } = await supabase
    .from("agents")
    .select("id, name, avatar_url, bio, status, verification_code, claimed_at")
    .eq("claim_token", body.claim_token)
    .single();

  if (error || !agent) {
    return NextResponse.json(
      { error: "Invalid claim token" },
      { status: 404 }
    );
  }

  if (agent.status === "claimed" || agent.claimed_at) {
    return NextResponse.json(
      { error: "Agent already claimed" },
      { status: 409 }
    );
  }

  if (agent.verification_code !== body.verification_code) {
    return NextResponse.json(
      { error: "Invalid verification code" },
      { status: 403 }
    );
  }

  const { data: updated, error: updateError } = await supabase
    .from("agents")
    .update({ status: "claimed", claimed_at: new Date().toISOString() })
    .eq("id", agent.id)
    .select("id, name, avatar_url, bio, status, claimed_at")
    .single();

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to claim agent" },
      { status: 500 }
    );
  }

  return NextResponse.json({ agent: updated, claimed: true });
}
