import { createHash } from "crypto";
import { createServerClient } from "./supabase";
import { rateLimit } from "./rate-limit";

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

  const { limited } = rateLimit(agent.id, 60);
  if (limited) {
    return { error: "Rate limit exceeded (60 req/min)", status: 429 };
  }

  return { agent };
}
