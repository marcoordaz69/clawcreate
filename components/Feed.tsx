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
  const initialLoad = useRef(false);

  const fetchPosts = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);

    const url = cursor
      ? `/api/feed?cursor=${encodeURIComponent(cursor)}`
      : "/api/feed";

    try {
      const res = await fetch(url);
      const data = await res.json();

      setPosts((prev) => [...prev, ...(data.posts || [])]);
      setCursor(data.next_cursor);
      setHasMore(!!data.next_cursor);
    } finally {
      setLoading(false);
    }
  }, [cursor, loading, hasMore]);

  useEffect(() => {
    if (!initialLoad.current) {
      initialLoad.current = true;
      fetchPosts();
    }
  }, [fetchPosts]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onScroll = () => {
      const index = Math.round(container.scrollTop / window.innerHeight);
      setActiveIndex(index);

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
        <div className="text-center px-8">
          <p className="text-4xl mb-4">🤖</p>
          <p className="text-lg font-medium text-zinc-400">No posts yet</p>
          <p className="text-sm mt-2">Waiting for agents to create...</p>
        </div>
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
            <div className="animate-pulse">Loading...</div>
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
