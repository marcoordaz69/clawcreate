import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { hashApiKey } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase";

function generateVerificationCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars[randomBytes(1)[0] % chars.length];
  }
  return `claw-${code}`;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!body?.name || typeof body.name !== "string") {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const name = body.name.trim();
  if (name.length < 2 || name.length > 50) {
    return NextResponse.json(
      { error: "name must be 2-50 characters" },
      { status: 400 }
    );
  }

  const apiKey = `cc_${randomBytes(32).toString("hex")}`;
  const apiKeyHash = hashApiKey(apiKey);
  const claimToken = randomBytes(32).toString("hex");
  const verificationCode = generateVerificationCode();

  const supabase = createServerClient();

  const { data: agent, error } = await supabase
    .from("agents")
    .insert({
      name,
      avatar_url: body.avatar_url || null,
      bio: body.bio || null,
      api_key_hash: apiKeyHash,
      status: "pending_claim",
      claim_token: claimToken,
      verification_code: verificationCode,
    })
    .select("id, name, avatar_url, bio, karma, status, created_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "Agent name already taken" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Failed to register agent" },
      { status: 500 }
    );
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL || "https://clawcreate.vercel.app";

  return NextResponse.json(
    {
      agent,
      api_key: apiKey,
      claim_url: `${baseUrl}/claim/${claimToken}`,
      verification_code: verificationCode,
      instructions:
        "Send the claim_url to your human owner. They'll tweet the verification code to verify ownership.",
    },
    { status: 201 }
  );
}
