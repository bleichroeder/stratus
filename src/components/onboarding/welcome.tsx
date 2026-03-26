"use client";

import {
  FileText,
  FolderPlus,
  Command,
  CalendarDays,
  Link2,
  Slash,
  ArrowRight,
} from "lucide-react";
import { LogoIcon } from "@/components/ui/logo";

interface WelcomeProps {
  onCreateNote: () => void;
  onDailyNote: () => void;
}

const features = [
  {
    icon: <Slash size={20} />,
    title: "Slash commands",
    description: "Type / to insert headings, lists, code blocks, and more",
  },
  {
    icon: <Link2 size={20} />,
    title: "Wiki links",
    description: "Type [[ to link notes together and build your knowledge graph",
  },
  {
    icon: <Command size={20} />,
    title: "Command palette",
    description: "Press Ctrl+K to quickly find notes and run actions",
  },
  {
    icon: <CalendarDays size={20} />,
    title: "Daily notes",
    description: "One-click journal entries organized by date",
  },
  {
    icon: <FolderPlus size={20} />,
    title: "Folders & drag-drop",
    description: "Organize notes into nested folders, rearrange by dragging",
  },
  {
    icon: <FileText size={20} />,
    title: "Rich editor",
    description: "Bold, italic, task lists, code blocks, images, and more",
  },
];

export function Welcome({ onCreateNote, onDailyNote }: WelcomeProps) {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-lg w-full space-y-8">
        <div className="text-center space-y-3">
          <LogoIcon size={48} className="mx-auto" />
          <div className="space-y-1">
            <h1 className="text-3xl font-bold text-stone-900 dark:text-stone-100">
              Welcome to stratus
            </h1>
            <p className="text-stone-500 dark:text-stone-400 font-mono text-sm">
              a developer-focused note-taking tool
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-lg border border-stone-200 dark:border-stone-800 p-3 space-y-1"
            >
              <div className="text-stone-400 dark:text-stone-500">
                {feature.icon}
              </div>
              <h3 className="text-sm font-medium text-stone-900 dark:text-stone-100">
                {feature.title}
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-center gap-3">
          <button
            onClick={onCreateNote}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-sm font-medium hover:bg-stone-800 dark:hover:bg-stone-200 transition-colors"
          >
            Create your first note
            <ArrowRight size={14} />
          </button>
          <button
            onClick={onDailyNote}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-stone-300 dark:border-stone-700 text-sm text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
          >
            <CalendarDays size={14} />
            Start a daily note
          </button>
        </div>
      </div>
    </div>
  );
}
