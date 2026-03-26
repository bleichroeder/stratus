"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogoFull } from "@/components/ui/logo";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setSuccess(true);
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50 dark:bg-stone-950">
        <div className="w-full max-w-sm space-y-4 rounded-lg border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-8 shadow-sm">
          <h1 className="text-2xl font-semibold text-stone-900 dark:text-stone-100">Check your email</h1>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account.
          </p>
          <Link
            href="/login"
            className="block text-center text-sm font-medium text-stone-900 dark:text-stone-100 hover:underline"
          >
            Back to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50 dark:bg-stone-950">
      <div className="w-full max-w-sm space-y-6 rounded-lg border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-8 shadow-sm">
        <div className="space-y-2">
          <LogoFull size={28} />
          <p className="text-sm text-stone-500 dark:text-stone-400 font-mono">create your account</p>
        </div>

        <form onSubmit={handleSignup} className="space-y-4">
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
              minLength={6}
              className="mt-1 block w-full rounded-md border border-stone-300 dark:border-stone-700 px-3 py-2 text-sm text-stone-900 dark:text-stone-100 bg-white dark:bg-stone-800 placeholder-stone-400 dark:placeholder-stone-500 focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
              placeholder="At least 6 characters"
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
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="text-center text-sm text-stone-500 dark:text-stone-400">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-stone-900 dark:text-stone-100 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
