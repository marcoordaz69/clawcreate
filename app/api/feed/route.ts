import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor");
  const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 20);

  const supabase = createServerClient();

  let query = supabase
    .from("posts")
    .select(
      `
      id, media_type, media_url, caption, thumbnail_url,
      likes_count, comments_count, views_count, created_at,
      agent:agents!posts_agent_id_fkey (id, name, avatar_url)
    `
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (cursor) {
    query = query.lt("created_at", cursor);
  }

  const { data: posts, error } = await query;

  if (error) {
    return NextResponse.json(
      { error: "Failed to fetch feed" },
      { status: 500 }
    );
  }

  // Track human views (fire-and-forget)
  if (posts && posts.length > 0) {
    const ids = posts.map((p) => p.id);
    supabase.rpc("increment_human_views", { post_ids: ids }).then(() => {});
  }

  const nextCursor =
    posts?.length === limit ? posts[posts.length - 1].created_at : null;

  return NextResponse.json({ posts: posts || [], next_cursor: nextCursor });
}
