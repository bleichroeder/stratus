import { LogoFull } from "@/components/ui/logo";
import Link from "next/link";

export const metadata = {
  title: "stratus – a developer-focused note-taking tool",
  description:
    "stratus is a fast, encrypted, developer-focused note-taking tool with real-time collaboration and Google Calendar integration.",
};

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white dark:bg-stone-950 flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-5xl mx-auto w-full">
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
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div className="max-w-2xl mx-auto space-y-6">
          <h1 className="text-4xl md:text-5xl font-bold text-stone-900 dark:text-stone-100 tracking-tight">
            Notes for developers,
            <br />
            <span className="text-stone-400 dark:text-stone-500">built for speed.</span>
          </h1>
          <p className="text-lg text-stone-600 dark:text-stone-400 max-w-lg mx-auto leading-relaxed">
            stratus is a fast, encrypted note-taking tool with real-time
            collaboration, Markdown support, and Google Calendar integration.
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

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto mt-20">
          <div className="text-left space-y-2 p-4">
            <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
              End-to-end encryption
            </h3>
            <p className="text-sm text-stone-500 dark:text-stone-400">
              Lock sensitive notes in an encrypted vault. Your keys never leave your device.
            </p>
          </div>
          <div className="text-left space-y-2 p-4">
            <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
              Real-time collaboration
            </h3>
            <p className="text-sm text-stone-500 dark:text-stone-400">
              Share notes and edit together in real time with conflict-free sync.
            </p>
          </div>
          <div className="text-left space-y-2 p-4">
            <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
              Calendar integration
            </h3>
            <p className="text-sm text-stone-500 dark:text-stone-400">
              Connect Google Calendar to create daily notes linked to your schedule.
            </p>
          </div>
        </div>

        {/* Google data usage disclosure */}
        <div className="max-w-2xl mx-auto mt-16 p-6 rounded-lg border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900/50 text-left">
          <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100 mb-2">
            How stratus uses Google data
          </h3>
          <p className="text-sm text-stone-500 dark:text-stone-400 leading-relaxed">
            When you connect your Google account, stratus accesses your Google
            Calendar events to display them alongside your daily notes. We only
            read calendar event titles, times, and descriptions. We do not
            modify, share, or store your Google data beyond what is needed to
            display it in the app. Our use of Google data complies with the{" "}
            <a
              href="https://developers.google.com/terms/api-services-user-data-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-stone-700 dark:hover:text-stone-300"
            >
              Google API Services User Data Policy
            </a>
            , including the Limited Use requirements.
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-stone-200 dark:border-stone-800 py-6 mt-20">
        <div className="flex flex-col md:flex-row items-center justify-between max-w-5xl mx-auto px-6 gap-4">
          <p className="text-xs text-stone-400 dark:text-stone-500">
            &copy; {new Date().getFullYear()}{" "}
            <span className="font-mono font-semibold">stratus</span>
          </p>
          <div className="flex items-center gap-4 text-xs text-stone-400 dark:text-stone-500">
            <Link href="/terms" className="hover:underline">
              Terms of Service
            </Link>
            <Link href="/policy" className="hover:underline">
              Privacy Policy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
