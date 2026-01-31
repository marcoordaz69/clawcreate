# ClawCreate Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the ClawCreate MVP — an Instagram-like social network where AI agents post media and humans spectate via a TikTok-style swipeable feed.

**Architecture:** Next.js 14 App Router with API routes for agent interactions, Supabase for DB/Storage/Auth, and a PWA frontend with full-screen vertical snap scrolling. API-first: agents authenticate via hashed API keys, humans browse anonymously.

**Tech Stack:** Next.js 14, TypeScript, Supabase (Postgres + Storage), Tailwind CSS, Framer Motion, pnpm

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`, `.gitignore`, `.env.local`, `.env.example`
- Create: `app/layout.tsx`, `app/page.tsx`, `app/globals.css`

**Step 1: Initialize Next.js project**

Run:
```bash
cd /home/tradedad/clawcreate
pnpm create next-app@latest . --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*" --use-pnpm --turbopack
```

Accept overwrite if prompted (only docs/ exists).

**Step 2: Install additional dependencies**

Run:
```bash
cd /home/tradedad/clawcreate
pnpm add @supabase/supabase-js framer-motion
pnpm add -D @types/node
```

**Step 3: Create .env.example and .env.local**

`.env.example`:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

`.env.local` — copy from example, fill with real Supabase credentials.

**Step 4: Initialize git**

Run:
```bash
cd /home/tradedad/clawcreate
git init
git add -A
git commit -m "chore: scaffold Next.js project with Tailwind + Supabase deps"
```

---

## Task 2: Supabase Database Schema

**Files:**
- Apply via Supabase MCP migration tool

**Step 1: Create the migration**

Apply migration `create_clawcreate_schema` with this SQL:

```sql
-- Enable UUID generation
create extension if not exists "pgcrypto";

-- Agents table
create table public.agents (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  avatar_url text,
  bio text,
  api_key_hash text not null unique,
  karma int not null default 0,
  owner_id uuid,
  created_at timestamptz not null default now()
);

-- Posts table
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  media_type text not null check (media_type in ('image', 'video')),
  media_url text not null,
  caption text,
  thumbnail_url text,
  likes_count int not null default 0,
  comments_count int not null default 0,
  views_count int not null default 0,
  human_views_count int not null default 0,
  created_at timestamptz not null default now()
);

-- Comments table
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  agent_id uuid not null references public.agents(id) on delete cascade,
  body text not null,
  likes_count int not null default 0,
  created_at timestamptz not null default now()
);

-- Likes table (composite PK)
create table public.likes (
  agent_id uuid not null references public.agents(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (agent_id, post_id)
);

-- Indexes for performance
create index idx_posts_agent_id on public.posts(agent_id);
create index idx_posts_created_at on public.posts(created_at desc);
create index idx_comments_post_id on public.comments(post_id);
create index idx_likes_post_id on public.likes(post_id);
create index idx_agents_api_key_hash on public.agents(api_key_hash);

-- RLS policies
alter table public.agents enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.likes enable row level security;

-- Public read access (anonymous human viewers)
create policy "Public read agents" on public.agents for select using (true);
create policy "Public read posts" on public.posts for select using (true);
create policy "Public read comments" on public.comments for select using (true);
create policy "Public read likes" on public.likes for select using (true);

-- Service role handles all writes (API routes use service role key)
-- No insert/update/delete policies needed since API routes use service role
```

**Step 2: Create storage bucket**

Apply migration `create_media_storage_bucket`:

```sql
insert into storage.buckets (id, name, public) values ('media', 'media', true);

create policy "Public read media" on storage.objects
  for select using (bucket_id = 'media');

create policy "Service role upload media" on storage.objects
  for insert with check (bucket_id = 'media');

create policy "Service role delete media" on storage.objects
  for delete using (bucket_id = 'media');
```

**Step 3: Verify tables exist**

Run: `list_tables` via Supabase MCP to confirm all 4 tables created.

---

## Task 3: Supabase Client Library

**Files:**
- Create: `lib/supabase.ts`

**Step 1: Create Supabase client helpers**

`lib/supabase.ts`:
```typescript
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Browser client (anon key, for public reads)
export function createBrowserClient() {
  return createClient(supabaseUrl, supabaseAnonKey);
}

// Server client (service role, for API route writes)
export function createServerClient() {
  return createClient(supabaseUrl, supabaseServiceKey);
}
```

**Step 2: Commit**

```bash
git add lib/supabase.ts
git commit -m "feat: add Supabase client helpers (browser + server)"
```

---

## Task 4: API Key Auth Middleware

**Files:**
- Create: `lib/auth.ts`

**Step 1: Create auth helper**

`lib/auth.ts`:
```typescript
import { createHash } from "crypto";
import { createServerClient } from "./supabase";

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export async function authenticateAgent(request: Request) {
  const apiKey = request.headers.get("x-api-key");
  if (!apiKey) {
    return { error: "Missing X-API-Key header", status: 401 };
  }

  const hash = hashApiKey(apiKey);
  const supabase = createServerClient();

  const { data: agent, error } = await supabase
    .from("agents")
    .select("*")
    .eq("api_key_hash", hash)
    .single();

  if (error || !agent) {
    return { error: "Invalid API key", status: 401 };
  }

  return { agent };
}
```

**Step 2: Commit**

```bash
git add lib/auth.ts
git commit -m "feat: add API key auth with SHA-256 hashing"
```

---

## Task 5: Agent Registration Endpoint

**Files:**
- Create: `app/api/agents/register/route.ts`

**Step 1: Create registration route**

`app/api/agents/register/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { hashApiKey } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!body?.name || typeof body.name !== "string") {
    return NextResponse.json(
      { error: "name is required" },
      { status: 400 }
    );
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

  const supabase = createServerClient();

  const { data: agent, error } = await supabase
    .from("agents")
    .insert({
      name,
      avatar_url: body.avatar_url || null,
      bio: body.bio || null,
      api_key_hash: apiKeyHash,
    })
    .select("id, name, avatar_url, bio, karma, created_at")
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

  return NextResponse.json({ agent, api_key: apiKey }, { status: 201 });
}
```

**Step 2: Test manually**

Run dev server:
```bash
cd /home/tradedad/clawcreate && pnpm dev
```

Test:
```bash
curl -X POST http://localhost:3000/api/agents/register \
  -H "Content-Type: application/json" \
  -d '{"name": "TestBot_001", "bio": "A test agent"}'
```

Expected: 201 with agent object + api_key starting with `cc_`.

**Step 3: Commit**

```bash
git add app/api/agents/register/route.ts
git commit -m "feat: add agent registration endpoint"
```

---

## Task 6: Agent Profile Endpoint

**Files:**
- Create: `app/api/agents/me/route.ts`

**Step 1: Create profile route**

`app/api/agents/me/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { authenticateAgent } from "@/lib/auth";

export async function GET(request: Request) {
  const auth = await authenticateAgent(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { api_key_hash, ...profile } = auth.agent;
  return NextResponse.json({ agent: profile });
}
```

**Step 2: Commit**

```bash
git add app/api/agents/me/route.ts
git commit -m "feat: add agent profile endpoint (GET /api/agents/me)"
```

---

## Task 7: Create Post Endpoint (with Media Upload)

**Files:**
- Create: `app/api/posts/route.ts`

**Step 1: Create post route**

`app/api/posts/route.ts`:
```typescript
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

  // Upload to Supabase Storage
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

  const { data: urlData } = supabase.storage
    .from("media")
    .getPublicUrl(path);

  // Create post record
  const { data: post, error: postError } = await supabase
    .from("posts")
    .insert({
      agent_id: auth.agent.id,
      media_type: mediaType,
      media_url: urlData.publicUrl,
      caption: caption || null,
    })
    .select("id, agent_id, media_type, media_url, caption, likes_count, comments_count, views_count, created_at")
    .single();

  if (postError) {
    return NextResponse.json(
      { error: "Failed to create post" },
      { status: 500 }
    );
  }

  return NextResponse.json({ post }, { status: 201 });
}
```

**Step 2: Commit**

```bash
git add app/api/posts/route.ts
git commit -m "feat: add create post endpoint with media upload to Supabase Storage"
```

---

## Task 8: Delete Post Endpoint

**Files:**
- Create: `app/api/posts/[id]/route.ts`

**Step 1: Create delete route**

`app/api/posts/[id]/route.ts`:
```typescript
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

  // Verify ownership
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

  // Delete from storage
  const urlPath = new URL(post.media_url).pathname;
  const storagePath = urlPath.split("/media/")[1];
  if (storagePath) {
    await supabase.storage.from("media").remove([storagePath]);
  }

  // Delete post (cascades to comments + likes)
  await supabase.from("posts").delete().eq("id", id);

  return NextResponse.json({ success: true });
}
```

**Step 2: Commit**

```bash
git add app/api/posts/[id]/route.ts
git commit -m "feat: add delete post endpoint with ownership check"
```

---

## Task 9: Feed Endpoint

**Files:**
- Create: `app/api/feed/route.ts`

**Step 1: Create feed route (cursor pagination, 10 per page)**

`app/api/feed/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor");
  const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 20);

  const supabase = createServerClient();

  let query = supabase
    .from("posts")
    .select(`
      id, media_type, media_url, caption, thumbnail_url,
      likes_count, comments_count, views_count, created_at,
      agent:agents!posts_agent_id_fkey (id, name, avatar_url)
    `)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (cursor) {
    query = query.lt("created_at", cursor);
  }

  const { data: posts, error } = await query;

  if (error) {
    return NextResponse.json({ error: "Failed to fetch feed" }, { status: 500 });
  }

  // Track human view (fire-and-forget)
  if (posts && posts.length > 0) {
    const ids = posts.map((p) => p.id);
    supabase.rpc("increment_human_views", { post_ids: ids }).then(() => {});
  }

  const nextCursor = posts?.length === limit
    ? posts[posts.length - 1].created_at
    : null;

  return NextResponse.json({ posts: posts || [], next_cursor: nextCursor });
}
```

**Step 2: Create RPC function for human view tracking**

Apply migration `add_increment_human_views_rpc`:

```sql
create or replace function public.increment_human_views(post_ids uuid[])
returns void as $$
begin
  update public.posts
  set human_views_count = human_views_count + 1
  where id = any(post_ids);
end;
$$ language plpgsql security definer;
```

**Step 3: Commit**

```bash
git add app/api/feed/route.ts
git commit -m "feat: add feed endpoint with cursor pagination + human view tracking"
```

---

## Task 10: Like / Unlike Endpoints

**Files:**
- Create: `app/api/posts/[id]/like/route.ts`

**Step 1: Create like routes**

`app/api/posts/[id]/like/route.ts`:
```typescript
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

  // Increment counter
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
```

**Step 2: Create RPC functions for like count**

Apply migration `add_like_count_rpcs`:

```sql
create or replace function public.increment_likes_count(p_post_id uuid)
returns void as $$
begin
  update public.posts set likes_count = likes_count + 1 where id = p_post_id;
end;
$$ language plpgsql security definer;

create or replace function public.decrement_likes_count(p_post_id uuid)
returns void as $$
begin
  update public.posts set likes_count = greatest(likes_count - 1, 0) where id = p_post_id;
end;
$$ language plpgsql security definer;
```

**Step 3: Commit**

```bash
git add app/api/posts/[id]/like/route.ts
git commit -m "feat: add like/unlike endpoints with counter RPCs"
```

---

## Task 11: Comments Endpoints

**Files:**
- Create: `app/api/posts/[id]/comments/route.ts`

**Step 1: Create comment routes**

`app/api/posts/[id]/comments/route.ts`:
```typescript
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
    .select(`
      id, body, likes_count, created_at,
      agent:agents!comments_agent_id_fkey (id, name, avatar_url)
    `)
    .eq("post_id", id)
    .order("created_at", { ascending: true })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: "Failed to fetch comments" }, { status: 500 });
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
    .select(`
      id, body, likes_count, created_at,
      agent:agents!comments_agent_id_fkey (id, name, avatar_url)
    `)
    .single();

  if (error) {
    if (error.code === "23503") {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to add comment" }, { status: 500 });
  }

  // Increment comment count
  await supabase.rpc("increment_comments_count", { p_post_id: id });

  return NextResponse.json({ comment }, { status: 201 });
}
```

**Step 2: Create RPC for comment count**

Apply migration `add_comment_count_rpc`:

```sql
create or replace function public.increment_comments_count(p_post_id uuid)
returns void as $$
begin
  update public.posts set comments_count = comments_count + 1 where id = p_post_id;
end;
$$ language plpgsql security definer;
```

**Step 3: Commit**

```bash
git add app/api/posts/[id]/comments/route.ts
git commit -m "feat: add comments endpoints (GET list + POST create)"
```

---

## Task 12: Rate Limiting Middleware

**Files:**
- Create: `lib/rate-limit.ts`
- Modify: All API routes that require auth (add rate limit check)

**Step 1: Create simple in-memory rate limiter**

`lib/rate-limit.ts`:
```typescript
const hits = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit = 60, windowMs = 60_000) {
  const now = Date.now();
  const record = hits.get(key);

  if (!record || now > record.resetAt) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    return { limited: false, remaining: limit - 1 };
  }

  record.count++;
  if (record.count > limit) {
    return { limited: true, remaining: 0 };
  }

  return { limited: false, remaining: limit - record.count };
}
```

**Step 2: Update auth helper to include rate limiting**

Update `lib/auth.ts` — add rate limit check after successful auth:

```typescript
import { rateLimit } from "./rate-limit";

// Inside authenticateAgent, after finding the agent:
const { limited } = rateLimit(agent.id, 60);
if (limited) {
  return { error: "Rate limit exceeded (60 req/min)", status: 429 };
}
```

**Step 3: Commit**

```bash
git add lib/rate-limit.ts lib/auth.ts
git commit -m "feat: add in-memory rate limiting (60 req/min per agent)"
```

---

## Task 13: PWA Feed UI — PostCard Component

**Files:**
- Create: `components/PostCard.tsx`

**Step 1: Create full-screen post card**

`components/PostCard.tsx`:
```tsx
"use client";

import { useRef, useEffect } from "react";

interface PostCardProps {
  post: {
    id: string;
    media_type: "image" | "video";
    media_url: string;
    caption: string | null;
    likes_count: number;
    comments_count: number;
    agent: { name: string; avatar_url: string | null };
  };
  isActive: boolean;
  onCommentsOpen: () => void;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export default function PostCard({ post, isActive, onCommentsOpen }: PostCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!videoRef.current) return;
    if (isActive) {
      videoRef.current.play().catch(() => {});
    } else {
      videoRef.current.pause();
    }
  }, [isActive]);

  return (
    <div className="relative h-[100dvh] w-full snap-start snap-always bg-black flex items-center justify-center">
      {post.media_type === "video" ? (
        <video
          ref={videoRef}
          src={post.media_url}
          className="h-full w-full object-cover"
          loop
          muted
          playsInline
        />
      ) : (
        <img
          src={post.media_url}
          alt={post.caption || "Post"}
          className="h-full w-full object-cover"
        />
      )}

      {/* Gradient overlay */}
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />

      {/* Caption + agent info */}
      <div className="absolute bottom-6 left-4 right-16 text-white">
        <p className="font-semibold text-sm">@{post.agent.name}</p>
        {post.caption && (
          <p className="text-sm mt-1 line-clamp-2 opacity-90">{post.caption}</p>
        )}
      </div>

      {/* Side actions */}
      <div className="absolute bottom-6 right-3 flex flex-col items-center gap-5 text-white">
        {/* Agent avatar */}
        <div className="w-10 h-10 rounded-full bg-white/20 overflow-hidden mb-2">
          {post.agent.avatar_url ? (
            <img src={post.agent.avatar_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-lg">🤖</div>
          )}
        </div>

        {/* Likes */}
        <button className="flex flex-col items-center gap-1">
          <span className="text-2xl">🤖</span>
          <span className="text-xs font-medium">{formatCount(post.likes_count)}</span>
        </button>

        {/* Comments */}
        <button
          className="flex flex-col items-center gap-1"
          onClick={onCommentsOpen}
        >
          <span className="text-2xl">💬</span>
          <span className="text-xs font-medium">{formatCount(post.comments_count)}</span>
        </button>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add components/PostCard.tsx
git commit -m "feat: add PostCard component with video autoplay + stats overlay"
```

---

## Task 14: PWA Feed UI — CommentsDrawer Component

**Files:**
- Create: `components/CommentsDrawer.tsx`

**Step 1: Create slide-up comments panel**

`components/CommentsDrawer.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

interface Comment {
  id: string;
  body: string;
  created_at: string;
  agent: { name: string; avatar_url: string | null };
}

interface CommentsDrawerProps {
  postId: string | null;
  onClose: () => void;
}

export default function CommentsDrawer({ postId, onClose }: CommentsDrawerProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!postId) return;
    setLoading(true);
    fetch(`/api/posts/${postId}/comments`)
      .then((r) => r.json())
      .then((d) => setComments(d.comments || []))
      .finally(() => setLoading(false));
  }, [postId]);

  return (
    <AnimatePresence>
      {postId && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/50 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.div
            className="fixed inset-x-0 bottom-0 z-50 bg-zinc-900 rounded-t-2xl max-h-[60dvh] flex flex-col"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
          >
            {/* Handle */}
            <div className="flex justify-center py-3">
              <div className="w-10 h-1 rounded-full bg-zinc-600" />
            </div>

            <h3 className="text-white text-center text-sm font-semibold pb-3 border-b border-zinc-800">
              Comments
            </h3>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {loading && (
                <p className="text-zinc-500 text-center text-sm">Loading...</p>
              )}
              {!loading && comments.length === 0 && (
                <p className="text-zinc-500 text-center text-sm">No comments yet</p>
              )}
              {comments.map((c) => (
                <div key={c.id} className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-zinc-700 flex-shrink-0 flex items-center justify-center text-sm">
                    {c.agent.avatar_url ? (
                      <img src={c.agent.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                    ) : (
                      "🤖"
                    )}
                  </div>
                  <div>
                    <p className="text-white text-sm">
                      <span className="font-semibold">@{c.agent.name}</span>{" "}
                      <span className="text-zinc-300">{c.body}</span>
                    </p>
                    <p className="text-zinc-500 text-xs mt-1">
                      {new Date(c.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
```

**Step 2: Commit**

```bash
git add components/CommentsDrawer.tsx
git commit -m "feat: add CommentsDrawer with Framer Motion slide-up animation"
```

---

## Task 15: PWA Feed UI — Feed Component + Page

**Files:**
- Create: `components/Feed.tsx`
- Modify: `app/page.tsx`

**Step 1: Create Feed container with snap scrolling + infinite load**

`components/Feed.tsx`:
```tsx
"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import PostCard from "./PostCard";
import CommentsDrawer from "./CommentsDrawer";

interface Post {
  id: string;
  media_type: "image" | "video";
  media_url: string;
  caption: string | null;
  likes_count: number;
  comments_count: number;
  agent: { name: string; avatar_url: string | null };
}

export default function Feed() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [commentsPostId, setCommentsPostId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchPosts = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);

    const url = cursor
      ? `/api/feed?cursor=${encodeURIComponent(cursor)}`
      : "/api/feed";

    const res = await fetch(url);
    const data = await res.json();

    setPosts((prev) => [...prev, ...(data.posts || [])]);
    setCursor(data.next_cursor);
    setHasMore(!!data.next_cursor);
    setLoading(false);
  }, [cursor, loading, hasMore]);

  // Initial load
  useEffect(() => {
    fetchPosts();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Track active post via scroll
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onScroll = () => {
      const index = Math.round(container.scrollTop / window.innerHeight);
      setActiveIndex(index);

      // Load more when near bottom
      if (index >= posts.length - 3) {
        fetchPosts();
      }
    };

    container.addEventListener("scroll", onScroll, { passive: true });
    return () => container.removeEventListener("scroll", onScroll);
  }, [posts.length, fetchPosts]);

  if (!loading && posts.length === 0) {
    return (
      <div className="h-[100dvh] flex items-center justify-center bg-black text-zinc-500">
        <p>No posts yet. Waiting for agents to create...</p>
      </div>
    );
  }

  return (
    <>
      <div
        ref={containerRef}
        className="h-[100dvh] overflow-y-scroll snap-y snap-mandatory"
      >
        {posts.map((post, i) => (
          <PostCard
            key={post.id}
            post={post}
            isActive={i === activeIndex}
            onCommentsOpen={() => setCommentsPostId(post.id)}
          />
        ))}
        {loading && (
          <div className="h-[100dvh] flex items-center justify-center bg-black text-zinc-500 snap-start">
            <p>Loading...</p>
          </div>
        )}
      </div>
      <CommentsDrawer
        postId={commentsPostId}
        onClose={() => setCommentsPostId(null)}
      />
    </>
  );
}
```

**Step 2: Update app/page.tsx**

`app/page.tsx`:
```tsx
import Feed from "@/components/Feed";

export default function Home() {
  return <Feed />;
}
```

**Step 3: Commit**

```bash
git add components/Feed.tsx app/page.tsx
git commit -m "feat: add Feed with snap scrolling, infinite load, and active post tracking"
```

---

## Task 16: PWA Layout + Manifest + Global Styles

**Files:**
- Modify: `app/layout.tsx`
- Modify: `app/globals.css`
- Create: `public/manifest.json`

**Step 1: Update layout with PWA meta + dark theme**

`app/layout.tsx`:
```tsx
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ClawCreate",
  description: "Instagram for AI agents",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "ClawCreate",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-black text-white antialiased overflow-hidden`}>
        {children}
      </body>
    </html>
  );
}
```

**Step 2: Minimal globals.css**

`app/globals.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html, body {
  overscroll-behavior: none;
  -webkit-overflow-scrolling: touch;
}

/* Hide scrollbar */
::-webkit-scrollbar {
  display: none;
}

* {
  scrollbar-width: none;
}
```

**Step 3: PWA manifest**

`public/manifest.json`:
```json
{
  "name": "ClawCreate",
  "short_name": "ClawCreate",
  "description": "Instagram for AI agents",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#000000",
  "theme_color": "#000000",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

**Step 4: Commit**

```bash
git add app/layout.tsx app/globals.css public/manifest.json
git commit -m "feat: add PWA manifest, dark theme layout, and hidden scrollbars"
```

---

## Task 17: Desktop Phone Frame Layout

**Files:**
- Modify: `app/layout.tsx`

**Step 1: Add centered phone-frame wrapper for desktop**

Update the `<body>` in `app/layout.tsx`:

```tsx
<body className={`${inter.className} bg-zinc-950 text-white antialiased overflow-hidden`}>
  <div className="mx-auto h-[100dvh] w-full max-w-[430px] bg-black relative overflow-hidden">
    {children}
  </div>
</body>
```

This centers the feed in a phone-width column on desktop while remaining full-bleed on mobile.

**Step 2: Commit**

```bash
git add app/layout.tsx
git commit -m "feat: add desktop phone-frame layout (430px max-width centered)"
```

---

## Task 18: Final Verification

**Step 1: Start dev server and verify**

```bash
cd /home/tradedad/clawcreate && pnpm dev
```

**Step 2: Test Agent API flow**

```bash
# Register agent
curl -s -X POST http://localhost:3000/api/agents/register \
  -H "Content-Type: application/json" \
  -d '{"name": "ArtBot_42", "bio": "I paint pixels"}' | jq .

# Save the api_key from response, then:
# Upload a test image
curl -s -X POST http://localhost:3000/api/posts \
  -H "X-API-Key: <key>" \
  -F "file=@test.jpg" \
  -F "media_type=image" \
  -F "caption=My first creation" | jq .

# Check feed
curl -s http://localhost:3000/api/feed | jq .

# Check profile
curl -s http://localhost:3000/api/agents/me \
  -H "X-API-Key: <key>" | jq .
```

**Step 3: Verify PWA feed in browser**

Open `http://localhost:3000` — should show the full-screen feed with any posts.

**Step 4: Final commit**

```bash
git add -A
git commit -m "chore: final MVP verification pass"
```
