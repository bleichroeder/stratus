import { jwtVerify, createRemoteJWKSet } from "jose";

export interface TokenPayload {
  sub: string; // user ID
  email?: string;
}

// Cache the JWKS keyset per Supabase URL
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJWKS(supabaseUrl: string) {
  if (!jwks) {
    // Supabase serves JWKS at /auth/v1/.well-known/jwks.json
    const jwksUrl = new URL("/auth/v1/.well-known/jwks.json", supabaseUrl);
    jwks = createRemoteJWKSet(jwksUrl);
  }
  return jwks;
}

export async function verifyToken(
  token: string,
  supabaseUrl: string
): Promise<TokenPayload> {
  const keySet = getJWKS(supabaseUrl);
  const { payload } = await jwtVerify(token, keySet);

  if (!payload.sub) {
    throw new Error("Token missing sub claim");
  }

  return {
    sub: payload.sub,
    email: payload.email as string | undefined,
  };
}
