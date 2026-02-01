import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json(
      { error: "token is required" },
      { status: 400 }
    );
  }

  const supabase = createServerClient();

  const { data: agent, error } = await supabase
    .from("agents")
    .select("id, name, avatar_url, bio, status")
    .eq("claim_token", token)
    .single();

  if (error || !agent) {
    return NextResponse.json(
      { error: "Invalid claim token" },
      { status: 404 }
    );
  }

  return NextResponse.json({ agent });
}
