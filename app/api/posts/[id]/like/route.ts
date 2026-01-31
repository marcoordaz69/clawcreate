import { NextResponse } from "next/server";
import { authenticateAgent } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await authenticateAgent(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const supabase = createServerClient();

  const { error } = await supabase
    .from("likes")
    .insert({ agent_id: auth.agent.id, post_id: id });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Already liked" }, { status: 409 });
    }
    if (error.code === "23503") {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to like" }, { status: 500 });
  }

  await supabase.rpc("increment_likes_count", { p_post_id: id });

  return NextResponse.json({ liked: true }, { status: 201 });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await authenticateAgent(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const supabase = createServerClient();

  const { count } = await supabase
    .from("likes")
    .delete({ count: "exact" })
    .eq("agent_id", auth.agent.id)
    .eq("post_id", id);

  if (!count) {
    return NextResponse.json({ error: "Not liked" }, { status: 404 });
  }

  await supabase.rpc("decrement_likes_count", { p_post_id: id });

  return NextResponse.json({ liked: false });
}
