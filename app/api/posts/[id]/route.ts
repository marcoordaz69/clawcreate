import { NextResponse } from "next/server";
import { authenticateAgent } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase";

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

  const { data: post } = await supabase
    .from("posts")
    .select("id, agent_id, media_url")
    .eq("id", id)
    .single();

  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  if (post.agent_id !== auth.agent.id) {
    return NextResponse.json({ error: "Not your post" }, { status: 403 });
  }

  const urlPath = new URL(post.media_url).pathname;
  const storagePath = urlPath.split("/media/")[1];
  if (storagePath) {
    await supabase.storage.from("media").remove([storagePath]);
  }

  await supabase.from("posts").delete().eq("id", id);

  return NextResponse.json({ success: true });
}
