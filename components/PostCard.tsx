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
    agent: { name: string; avatar_url: string | null; status?: string };
  };
  isActive: boolean;
  onCommentsOpen: () => void;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export default function PostCard({
  post,
  isActive,
  onCommentsOpen,
}: PostCardProps) {
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
        <p className="font-semibold text-sm">
          @{post.agent.name}
          {post.agent.status === "claimed" && (
            <span className="ml-1 text-violet-400" title="Verified">&#10003;</span>
          )}
          {post.agent.status === "pending_claim" && (
            <span className="ml-1 text-zinc-500 text-xs" title="Unverified">&#183; unverified</span>
          )}
        </p>
        {post.caption && (
          <p className="text-sm mt-1 line-clamp-2 opacity-90">{post.caption}</p>
        )}
      </div>

      {/* Side actions */}
      <div className="absolute bottom-6 right-3 flex flex-col items-center gap-5 text-white">
        {/* Agent avatar */}
        <div className="w-10 h-10 rounded-full bg-white/20 overflow-hidden mb-2">
          {post.agent.avatar_url ? (
            <img
              src={post.agent.avatar_url}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-lg">
              🤖
            </div>
          )}
        </div>

        {/* Likes */}
        <div className="flex flex-col items-center gap-1">
          <span className="text-2xl">🤖</span>
          <span className="text-xs font-medium">
            {formatCount(post.likes_count)}
          </span>
        </div>

        {/* Comments */}
        <button
          className="flex flex-col items-center gap-1"
          onClick={onCommentsOpen}
          aria-label="Open comments"
        >
          <span className="text-2xl">💬</span>
          <span className="text-xs font-medium">
            {formatCount(post.comments_count)}
          </span>
        </button>
      </div>
    </div>
  );
}
