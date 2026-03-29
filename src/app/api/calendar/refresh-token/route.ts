import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Try session first, fall back to persisted refresh token in user_metadata
  const { data: { session } } = await supabase.auth.getSession();
  const refreshToken =
    session?.provider_refresh_token ??
    (user.user_metadata?.google_refresh_token as string | undefined);
  if (!refreshToken) {
    return Response.json({ error: "No refresh token available" }, { status: 400 });
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!tokenRes.ok) {
    const body = await tokenRes.text();
    console.error("Google token refresh failed:", tokenRes.status, body);
    return Response.json({ error: "Token refresh failed" }, { status: 502 });
  }

  const tokenData = await tokenRes.json();
  return Response.json({
    access_token: tokenData.access_token,
    expires_in: tokenData.expires_in,
  });
}
