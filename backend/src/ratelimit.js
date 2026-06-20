// ratelimit.js
// Simple in-memory rate limiter: 20 requests / minute / client IP on /ask.
// No external dependency. Fine for an MVP / single instance; for multi-instance
// production you'd back this with Redis instead.

const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 20;

const hits = new Map(); // key -> array of request timestamps in current window

export function rateLimit(req, res, next) {
  const key = req.ip || req.socket?.remoteAddress || "unknown";
  const now = Date.now();

  const timestamps = (hits.get(key) || []).filter((t) => now - t < WINDOW_MS);

  if (timestamps.length >= MAX_REQUESTS) {
    const retryMs = WINDOW_MS - (now - timestamps[0]);
    res.set("Retry-After", String(Math.ceil(retryMs / 1000)));
    return res.status(429).json({
      error: "Too many requests. Please wait a moment and try again.",
    });
  }

  timestamps.push(now);
  hits.set(key, timestamps);
  next();
}

// Periodically clean up idle keys so the map doesn't grow forever.
setInterval(() => {
  const now = Date.now();
  for (const [key, ts] of hits.entries()) {
    const recent = ts.filter((t) => now - t < WINDOW_MS);
    if (recent.length === 0) hits.delete(key);
    else hits.set(key, recent);
  }
}, WINDOW_MS).unref();