"use client";

import {
  CalendarDays,
  ArrowRight,
  Plus,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { LogoIcon } from "@/components/ui/logo";

interface WelcomeProps {
  onCreateNote: () => void;
  onDailyNote: () => void;
}

export function Welcome({ onCreateNote, onDailyNote }: WelcomeProps) {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-sm w-full space-y-6 text-center">
        <div className="space-y-2">
          <LogoIcon size={40} className="mx-auto" />
          <h1 className="text-xl font-semibold text-stone-900 dark:text-stone-100">
            Welcome to stratus
          </h1>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            Create a note or import your existing ones.
          </p>
        </div>

        <div className="flex flex-col gap-3 w-full">
          <button
            onClick={onCreateNote}
            className="flex items-center justify-center gap-2 w-full px-5 py-2.5 rounded-lg bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-sm font-medium hover:bg-stone-800 dark:hover:bg-stone-200 transition-colors"
          >
            <Plus size={16} />
            New note
          </button>
          <div className="flex gap-3">
            <button
              onClick={onDailyNote}
              className="flex items-center justify-center gap-2 flex-1 px-4 py-2.5 rounded-lg border border-stone-300 dark:border-stone-700 text-sm text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
            >
              <CalendarDays size={16} />
              Daily note
            </button>
            <Link
              href="/import"
              className="flex items-center justify-center gap-2 flex-1 px-4 py-2.5 rounded-lg border border-stone-300 dark:border-stone-700 text-sm text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
            >
              <Upload size={16} />
              Import
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
