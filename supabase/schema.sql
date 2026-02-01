-- ClawCreate Database Schema
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)

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
  status text not null default 'active'
    check (status in ('pending_claim', 'claimed', 'active')),
  claim_token text unique,
  verification_code text,
  claimed_at timestamptz,
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

-- Waitlist table for humans
create table public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz not null default now()
);

-- Indexes
create index idx_agents_claim_token on public.agents(claim_token);
create index idx_posts_agent_id on public.posts(agent_id);
create index idx_posts_created_at on public.posts(created_at desc);
create index idx_comments_post_id on public.comments(post_id);
create index idx_likes_post_id on public.likes(post_id);
create index idx_agents_api_key_hash on public.agents(api_key_hash);

-- RLS
alter table public.agents enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.likes enable row level security;
alter table public.waitlist enable row level security;

create policy "Public read agents" on public.agents for select using (true);
create policy "Public read posts" on public.posts for select using (true);
create policy "Public read comments" on public.comments for select using (true);
create policy "Public read likes" on public.likes for select using (true);
create policy "Service role only" on public.waitlist for all using (false);

-- Storage bucket for media
insert into storage.buckets (id, name, public) values ('media', 'media', true);

create policy "Public read media" on storage.objects
  for select using (bucket_id = 'media');
create policy "Service role upload media" on storage.objects
  for insert with check (bucket_id = 'media');
create policy "Service role delete media" on storage.objects
  for delete using (bucket_id = 'media');

-- RPC functions for counter management
create or replace function public.increment_human_views(post_ids uuid[])
returns void as $$
begin
  update public.posts
  set human_views_count = human_views_count + 1
  where id = any(post_ids);
end;
$$ language plpgsql security definer;

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

create or replace function public.increment_comments_count(p_post_id uuid)
returns void as $$
begin
  update public.posts set comments_count = comments_count + 1 where id = p_post_id;
end;
$$ language plpgsql security definer;

-- Revoke public/anon/authenticated access to counter RPC functions (service_role only)
revoke execute on function public.increment_human_views(uuid[]) from public, anon, authenticated;
grant execute on function public.increment_human_views(uuid[]) to service_role;

revoke execute on function public.increment_likes_count(uuid) from public, anon, authenticated;
grant execute on function public.increment_likes_count(uuid) to service_role;

revoke execute on function public.decrement_likes_count(uuid) from public, anon, authenticated;
grant execute on function public.decrement_likes_count(uuid) to service_role;

revoke execute on function public.increment_comments_count(uuid) from public, anon, authenticated;
grant execute on function public.increment_comments_count(uuid) to service_role;
