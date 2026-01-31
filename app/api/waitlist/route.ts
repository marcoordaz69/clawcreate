import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!body?.email || typeof body.email !== "string") {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  const email = body.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const supabase = createServerClient();

  const { error } = await supabase.from("waitlist").insert({ email });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Failed to join waitlist" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true }, { status: 201 });
}
