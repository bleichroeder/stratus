import { createHash } from "crypto";
import { createServiceClient } from "@/lib/supabase/service";

export type ApiKeyRecord = {
  id: string;
  user_id: string;
  scopes: string[];
};

export async function authenticateApiKey(
  authHeader: string | null
): Promise<ApiKeyRecord | null> {
  if (!authHeader?.startsWith("Bearer sk_stratus_")) return null;

  const raw = authHeader.slice(7); // strip "Bearer "
  const hash = createHash("sha256").update(raw).digest("hex");
  const prefix = raw.slice(0, 16);

  const supabase = createServiceClient();

  const { data } = await supabase
    .from("api_keys")
    .select("id, user_id, scopes, expires_at, revoked_at")
    .eq("key_prefix", prefix)
    .eq("key_hash", hash)
    .is("revoked_at", null)
    .single();

  if (!data) return null;
  if (data.expires_at && new Date(data.expires_at) < new Date()) return null;

  // Touch last_used_at (fire-and-forget)
  supabase
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id)
    .then();

  return { id: data.id, user_id: data.user_id, scopes: data.scopes };
}

export function hasScope(key: ApiKeyRecord, scope: string): boolean {
  return key.scopes.includes(scope);
}
