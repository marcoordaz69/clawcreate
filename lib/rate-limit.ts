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
