import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { email } = await request.json();
  if (!email || typeof email !== "string") {
    return Response.json({ error: "Email is required" }, { status: 400 });
  }

  const trimmedEmail = email.trim().toLowerCase();

  if (trimmedEmail === user.email?.toLowerCase()) {
    return Response.json(
      { error: "Cannot invite yourself" },
      { status: 400 }
    );
  }

  // Try to find existing user
  const { data, error } = await supabase.rpc("lookup_user_by_email", {
    p_email: trimmedEmail,
  });

  if (error) {
    return Response.json({ error: "Lookup failed" }, { status: 500 });
  }

  // User exists — return their ID
  if (data && data.length > 0) {
    const found = data[0];
    return Response.json({
      userId: found.id,
      email: found.email,
      invited: false,
    });
  }

  // User doesn't exist — send a product invite via Supabase Auth
  const serviceClient = createServiceClient();
  const { data: inviteData, error: inviteError } =
    await serviceClient.auth.admin.inviteUserByEmail(trimmedEmail, {
      redirectTo: `${request.headers.get("origin") ?? ""}/callback`,
    });

  if (inviteError) {
    console.error("Invite error:", inviteError);
    return Response.json(
      { error: "Failed to send invitation" },
      { status: 500 }
    );
  }

  if (!inviteData.user) {
    return Response.json(
      { error: "Failed to create invitation" },
      { status: 500 }
    );
  }

  return Response.json({
    userId: inviteData.user.id,
    email: trimmedEmail,
    invited: true,
  });
}
