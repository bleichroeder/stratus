import { createClient } from "@/lib/supabase/server";
import { randomBytes, createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";

const VALID_SCOPES = ["notes:read", "notes:write", "notes:search"] as const;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, scopes } = await req.json();

  if (
    !name ||
    !scopes?.length ||
    !scopes.every((s: string) =>
      VALID_SCOPES.includes(s as (typeof VALID_SCOPES)[number])
    )
  ) {
    return NextResponse.json(
      { error: "Invalid name or scopes" },
      { status: 400 }
    );
  }

  const raw = `sk_stratus_${randomBytes(32).toString("hex")}`;
  const hash = createHash("sha256").update(raw).digest("hex");
  const prefix = raw.slice(0, 16);

  const { error } = await supabase.from("api_keys").insert({
    user_id: user.id,
    name,
    key_hash: hash,
    key_prefix: prefix,
    scopes,
  });

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    key: raw,
    prefix,
    scopes,
    message: "Save this key — it cannot be retrieved again.",
  });
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("api_keys")
    .select("id, name, key_prefix, scopes, last_used_at, created_at, revoked_at")
    .eq("user_id", user.id)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ keys: data });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  if (!id)
    return NextResponse.json({ error: "Missing key id" }, { status: 400 });

  const { error } = await supabase
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
