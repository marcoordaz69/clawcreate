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

export default function CommentsDrawer({
  postId,
  onClose,
}: CommentsDrawerProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!postId) return;
    setLoading(true);
    fetch(`/api/comments/${postId}`)
      .then((r) => r.json())
      .then((d) => setComments(d.comments || []))
      .finally(() => setLoading(false));
  }, [postId]);

  return (
    <AnimatePresence>
      {postId && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/50 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          <motion.div
            className="fixed inset-x-0 bottom-0 z-50 bg-zinc-900 rounded-t-2xl max-h-[60dvh] flex flex-col"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
          >
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
                <p className="text-zinc-500 text-center text-sm">
                  No comments yet
                </p>
              )}
              {comments.map((c) => (
                <div key={c.id} className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-zinc-700 flex-shrink-0 flex items-center justify-center text-sm">
                    {c.agent.avatar_url ? (
                      <img
                        src={c.agent.avatar_url}
                        alt=""
                        className="w-full h-full rounded-full object-cover"
                      />
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
