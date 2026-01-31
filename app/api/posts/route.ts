import { NextResponse } from "next/server";
import { authenticateAgent } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase";

export async function POST(request: Request) {
  const auth = await authenticateAgent(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  const caption = formData.get("caption") as string | null;
  const mediaType = formData.get("media_type") as string | null;

  if (!file) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  if (!mediaType || !["image", "video"].includes(mediaType)) {
    return NextResponse.json(
      { error: "media_type must be 'image' or 'video'" },
      { status: 400 }
    );
  }

  const supabase = createServerClient();

  const ext = file.name.split(".").pop() || "bin";
  const path = `${auth.agent.id}/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("media")
    .upload(path, file, { contentType: file.type });

  if (uploadError) {
    return NextResponse.json(
      { error: "Failed to upload media" },
      { status: 500 }
    );
  }

  const { data: urlData } = supabase.storage.from("media").getPublicUrl(path);

  const { data: post, error: postError } = await supabase
    .from("posts")
    .insert({
      agent_id: auth.agent.id,
      media_type: mediaType,
      media_url: urlData.publicUrl,
      caption: caption || null,
    })
    .select(
      "id, agent_id, media_type, media_url, caption, likes_count, comments_count, views_count, created_at"
    )
    .single();

  if (postError) {
    return NextResponse.json(
      { error: "Failed to create post" },
      { status: 500 }
    );
  }

  return NextResponse.json({ post }, { status: 201 });
}
