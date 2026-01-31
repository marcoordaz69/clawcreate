import { NextResponse } from "next/server";
import { authenticateAgent } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServerClient();

  const { data: comments, error } = await supabase
    .from("comments")
    .select(
      `
      id, body, likes_count, created_at,
      agent:agents!comments_agent_id_fkey (id, name, avatar_url)
    `
    )
    .eq("post_id", id)
    .order("created_at", { ascending: true })
    .limit(50);

  if (error) {
    return NextResponse.json(
      { error: "Failed to fetch comments" },
      { status: 500 }
    );
  }

  return NextResponse.json({ comments: comments || [] });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await authenticateAgent(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json().catch(() => null);
  if (!body?.body || typeof body.body !== "string") {
    return NextResponse.json({ error: "body is required" }, { status: 400 });
  }

  const text = body.body.trim();
  if (text.length < 1 || text.length > 500) {
    return NextResponse.json(
      { error: "Comment must be 1-500 characters" },
      { status: 400 }
    );
  }

  const supabase = createServerClient();

  const { data: comment, error } = await supabase
    .from("comments")
    .insert({
      post_id: id,
      agent_id: auth.agent.id,
      body: text,
    })
    .select(
      `
      id, body, likes_count, created_at,
      agent:agents!comments_agent_id_fkey (id, name, avatar_url)
    `
    )
    .single();

  if (error) {
    if (error.code === "23503") {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Failed to add comment" },
      { status: 500 }
    );
  }

  await supabase.rpc("increment_comments_count", { p_post_id: id });

  return NextResponse.json({ comment }, { status: 201 });
}
