import { LogoFull } from "@/components/ui/logo";
import { FloatingOrbs } from "@/components/ui/floating-orbs";
import Link from "next/link";

export const metadata = {
  title: "stratus – a place for your thoughts",
  description:
    "Fast, simple notes you can access anywhere.",
};

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white dark:bg-stone-950 flex flex-col relative overflow-hidden">
      <FloatingOrbs />
      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-4 max-w-5xl mx-auto w-full">
        <LogoFull size={28} />
        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className="text-sm text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 transition-colors"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="text-sm font-medium rounded-md bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 px-4 py-2 hover:bg-stone-800 dark:hover:bg-stone-200 transition-colors"
          >
            Get started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-6 text-center">
        <div className="max-w-xl mx-auto space-y-6">
          <h1 className="text-4xl md:text-5xl font-bold text-stone-900 dark:text-stone-100 tracking-tight">
            A place for your thoughts.
          </h1>
          <p className="text-base text-stone-500 dark:text-stone-400 max-w-sm mx-auto leading-relaxed">
            Fast, simple notes you can access anywhere.
          </p>
          <div className="flex items-center justify-center gap-4 pt-2">
            <Link
              href="/signup"
              className="rounded-md bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 px-6 py-2.5 text-sm font-medium hover:bg-stone-800 dark:hover:bg-stone-200 transition-colors"
            >
              Get started free
            </Link>
            <Link
              href="/login"
              className="rounded-md border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 px-6 py-2.5 text-sm font-medium hover:bg-stone-50 dark:hover:bg-stone-900 transition-colors"
            >
              Sign in
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-stone-200 dark:border-stone-800 py-6">
        <div className="flex flex-col md:flex-row items-center justify-between max-w-5xl mx-auto px-6 gap-4">
          <p className="text-xs text-stone-400 dark:text-stone-500">
            &copy; {new Date().getFullYear()}{" "}
            <span className="font-mono font-semibold">stratus</span>
          </p>
          <div className="flex items-center gap-4 text-xs text-stone-400 dark:text-stone-500">
            <Link href="/terms" className="hover:underline">
              Terms
            </Link>
            <Link href="/policy" className="hover:underline">
              Privacy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
