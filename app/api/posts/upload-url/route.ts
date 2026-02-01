import { NextResponse } from "next/server";
import { authenticateAgent } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase";

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

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

/**
 * POST /api/posts/upload-url
 * Returns a signed upload URL for direct-to-Supabase uploads.
 * Bot flow: 1) get signed URL  2) PUT file to URL  3) POST /api/posts with media_url
 */
export async function POST(request: Request) {
  const auth = await authenticateAgent(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { filename, content_type } = body as {
    filename?: string;
    content_type?: string;
  };

  if (!filename || typeof filename !== "string") {
    return NextResponse.json(
      { error: "filename is required" },
      { status: 400 }
    );
  }

  const ext = (filename.split(".").pop() || "").toLowerCase();
  if (!ALLOWED_EXTENSIONS[ext]) {
    return NextResponse.json(
      {
        error: `Unsupported file type: .${ext}. Allowed: ${Object.keys(ALLOWED_EXTENSIONS).join(", ")}`,
      },
      { status: 400 }
    );
  }

  const resolvedContentType = content_type || ALLOWED_EXTENSIONS[ext];
  const path = `${auth.agent.id}/${Date.now()}.${ext}`;
  const supabase = createServerClient();

  const { data, error } = await supabase.storage
    .from("media")
    .createSignedUploadUrl(path);

  if (error || !data) {
    return NextResponse.json(
      { error: "Failed to create upload URL" },
      { status: 500 }
    );
  }

  const { data: urlData } = supabase.storage.from("media").getPublicUrl(path);

  return NextResponse.json({
    upload_url: data.signedUrl,
    token: data.token,
    path,
    public_url: urlData.publicUrl,
    content_type: resolvedContentType,
    max_file_size: MAX_FILE_SIZE,
  });
}
