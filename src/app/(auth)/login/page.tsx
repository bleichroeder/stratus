"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogoFull } from "@/components/ui/logo";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      // Cache password for vault auto-unlock (cleared after use or on tab close)
      try { sessionStorage.setItem("_vp", password); } catch {}
      router.push("/dashboard");
      router.refresh();
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50 dark:bg-stone-950">
      <div className="w-full max-w-sm space-y-6 rounded-lg border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-8 shadow-sm">
        <div className="space-y-2">
          <LogoFull size={28} />
          <p className="text-sm text-stone-500 dark:text-stone-400 font-mono">sign in to your account</p>
        </div>

        <GoogleSignInButton />

        <div className="flex items-center gap-3 text-xs text-stone-400 dark:text-stone-500">
          <div className="flex-1 h-px bg-stone-200 dark:bg-stone-700" />
          <span>or</span>
          <div className="flex-1 h-px bg-stone-200 dark:bg-stone-700" />
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-stone-700 dark:text-stone-300">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 block w-full rounded-md border border-stone-300 dark:border-stone-700 px-3 py-2 text-sm text-stone-900 dark:text-stone-100 bg-white dark:bg-stone-800 placeholder-stone-400 dark:placeholder-stone-500 focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-stone-700 dark:text-stone-300">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1 block w-full rounded-md border border-stone-300 dark:border-stone-700 px-3 py-2 text-sm text-stone-900 dark:text-stone-100 bg-white dark:bg-stone-800 placeholder-stone-400 dark:placeholder-stone-500 focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
              placeholder="Your password"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-stone-900 dark:bg-stone-100 px-4 py-2 text-sm font-medium text-white dark:text-stone-900 hover:bg-stone-800 dark:hover:bg-stone-200 disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="text-center text-sm text-stone-500 dark:text-stone-400">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-medium text-stone-900 dark:text-stone-100 hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
