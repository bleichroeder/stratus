"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { ApiKeysSection } from "@/components/settings/api-keys";
import { ImportSection } from "@/components/settings/import-section";
import { ExportSection } from "@/components/settings/export-section";

export default function SettingsPage() {
  return (
    <div className="flex-1 overflow-auto bg-white dark:bg-stone-950">
      <div className="max-w-2xl mx-auto px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex items-center gap-3 mb-6 sm:mb-8">
          <Link
            href="/dashboard"
            className="p-1.5 rounded-md hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500 dark:text-stone-400"
          >
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-lg font-semibold text-stone-900 dark:text-stone-100">
            Settings
          </h1>
        </div>
        <ApiKeysSection />
        <ImportSection />
        <ExportSection />
      </div>
    </div>
  );
}
