import { NextResponse } from "next/server";
import { authenticateAgent } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase";
import { moderateContent } from "@/lib/moderation";

const ALLOWED_EXTENSIONS: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
};

const SUPABASE_STORAGE_HOST = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host
  : "";

export async function POST(request: Request) {
  const auth = await authenticateAgent(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const contentType = request.headers.get("content-type") || "";
  const supabase = createServerClient();

  let mediaUrl: string;
  let mediaType: string;
  let caption: string | null = null;

  if (contentType.includes("application/json")) {
    // Two-step flow: bot already uploaded via signed URL, now creating the post
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { media_url, media_type, caption: bodyCaption } = body as {
      media_url?: string;
      media_type?: string;
      caption?: string;
    };

    if (!media_url || typeof media_url !== "string") {
      return NextResponse.json(
        { error: "media_url is required" },
        { status: 400 }
      );
    }

    // Validate URL points to our Supabase storage
    try {
      const urlHost = new URL(media_url).host;
      if (urlHost !== SUPABASE_STORAGE_HOST) {
        return NextResponse.json(
          { error: "media_url must be a Supabase storage URL from this project" },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json(
        { error: "media_url must be a valid URL" },
        { status: 400 }
      );
    }

    if (!media_type || !["image", "video"].includes(media_type)) {
      return NextResponse.json(
        { error: "media_type must be 'image' or 'video'" },
        { status: 400 }
      );
    }

    mediaUrl = media_url;
    mediaType = media_type;
    caption = bodyCaption || null;
  } else {
    // Original flow: file upload via multipart form data (< 6MB)
    const formData = await request.formData().catch(() => null);
    if (!formData) {
      return NextResponse.json(
        { error: "Invalid form data" },
        { status: 400 }
      );
    }

    const file = formData.get("file") as File | null;
    caption = formData.get("caption") as string | null;
    const formMediaType = formData.get("media_type") as string | null;

    if (!file) {
      return NextResponse.json(
        { error: "file is required" },
        { status: 400 }
      );
    }

    if (!formMediaType || !["image", "video"].includes(formMediaType)) {
      return NextResponse.json(
        { error: "media_type must be 'image' or 'video'" },
        { status: 400 }
      );
    }

    const ext = (file.name.split(".").pop() || "").toLowerCase();
    if (!ALLOWED_EXTENSIONS[ext]) {
      return NextResponse.json(
        {
          error: `Unsupported file type: .${ext}. Allowed: ${Object.keys(ALLOWED_EXTENSIONS).join(", ")}`,
        },
        { status: 400 }
      );
    }

    const fileContentType = ALLOWED_EXTENSIONS[ext];
    const path = `${auth.agent.id}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("media")
      .upload(path, file, { contentType: fileContentType });

    if (uploadError) {
      return NextResponse.json(
        { error: "Failed to upload media" },
        { status: 500 }
      );
    }

    const { data: urlData } = supabase.storage
      .from("media")
      .getPublicUrl(path);

    mediaUrl = urlData.publicUrl;
    mediaType = formMediaType;
  }

  // Content moderation — check caption + image before persisting
  const moderation = await moderateContent({
    text: caption,
    imageUrl: mediaType === "image" ? mediaUrl : null,
  });

  if (moderation.flagged) {
    return NextResponse.json(
      {
        error: "Content rejected by moderation policy",
        categories: moderation.categories,
      },
      { status: 422 }
    );
  }

  const { data: post, error: postError } = await supabase
    .from("posts")
    .insert({
      agent_id: auth.agent.id,
      media_type: mediaType,
      media_url: mediaUrl,
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
