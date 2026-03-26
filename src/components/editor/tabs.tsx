"use client";

import { useRef, useState, useEffect } from "react";
import { X, FileText, ChevronLeft, ChevronRight } from "lucide-react";

export interface Tab {
  id: string;
  title: string;
}

interface TabBarProps {
  tabs: Tab[];
  activeTabId: string | null;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onCloseOthers: (id: string) => void;
  onCloseAll: () => void;
  onRenameNote: (id: string, title: string) => void;
}

interface ContextMenu {
  tabId: string;
  x: number;
  y: number;
}

function TabItem({
  tab,
  isActive,
  onSelect,
  onClose,
  onContextMenu,
  onRename,
}: {
  tab: Tab;
  isActive: boolean;
  onSelect: () => void;
  onClose: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onRename: (title: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(tab.title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  function commitRename() {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== tab.title) {
      onRename(trimmed);
    }
    setEditing(false);
  }

  return (
    <div
      data-tab-id={tab.id}
      className={`flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 text-sm cursor-pointer border-r border-stone-200 dark:border-stone-800 min-w-0 max-w-[180px] shrink-0 transition-colors ${
        isActive
          ? "bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100"
          : "text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800"
      }`}
      onClick={() => {
        if (!editing) onSelect();
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        setEditValue(tab.title);
        setEditing(true);
      }}
      onContextMenu={onContextMenu}
    >
      <FileText size={12} className="shrink-0" />
      {editing ? (
        <input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitRename();
            if (e.key === "Escape") setEditing(false);
          }}
          onClick={(e) => e.stopPropagation()}
          className="flex-1 min-w-0 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-600 rounded px-1 py-0 text-sm text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-stone-500"
        />
      ) : (
        <span className="truncate">{tab.title}</span>
      )}
      {!editing && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="shrink-0 p-0.5 rounded hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300"
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}

export function TabBar({ tabs, activeTabId, onSelectTab, onCloseTab, onCloseOthers, onCloseAll, onRenameNote }: TabBarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);

  function checkScroll() {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", checkScroll, { passive: true });
    const observer = new ResizeObserver(checkScroll);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", checkScroll);
      observer.disconnect();
    };
  }, [tabs.length]);

  useEffect(() => {
    if (!activeTabId || !scrollRef.current) return;
    const activeEl = scrollRef.current.querySelector(`[data-tab-id="${activeTabId}"]`) as HTMLElement | null;
    activeEl?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeTabId]);

  useEffect(() => {
    if (!contextMenu) return;
    function handleClick() {
      setContextMenu(null);
    }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [contextMenu]);

  function scrollBy(delta: number) {
    scrollRef.current?.scrollBy({ left: delta, behavior: "smooth" });
  }

  if (tabs.length === 0) return null;

  return (
    <div className="relative flex items-center border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900">
      {canScrollLeft && (
        <button
          onClick={() => scrollBy(-150)}
          className="absolute left-0 z-10 h-full pl-1.5 pr-4 bg-gradient-to-r from-stone-100 dark:from-stone-900 via-stone-100/90 dark:via-stone-900/90 to-transparent flex items-center shadow-[4px_0_8px_-2px_rgba(0,0,0,0.08)] dark:shadow-[4px_0_8px_-2px_rgba(0,0,0,0.3)]"
        >
          <ChevronLeft size={16} className="text-stone-600 dark:text-stone-300" />
        </button>
      )}

      <div
        ref={scrollRef}
        className="flex items-center overflow-x-auto overflow-y-hidden scrollbar-none"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {tabs.map((tab) => (
          <TabItem
            key={tab.id}
            tab={tab}
            isActive={tab.id === activeTabId}
            onSelect={() => onSelectTab(tab.id)}
            onClose={() => onCloseTab(tab.id)}
            onContextMenu={(e) => {
              e.preventDefault();
              setContextMenu({ tabId: tab.id, x: e.clientX, y: e.clientY });
            }}
            onRename={(title) => onRenameNote(tab.id, title)}
          />
        ))}
      </div>

      {canScrollRight && (
        <button
          onClick={() => scrollBy(150)}
          className="absolute right-0 z-10 h-full pr-1.5 pl-4 bg-gradient-to-l from-stone-100 dark:from-stone-900 via-stone-100/90 dark:via-stone-900/90 to-transparent flex items-center shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.08)] dark:shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.3)]"
        >
          <ChevronRight size={16} className="text-stone-600 dark:text-stone-300" />
        </button>
      )}

      {contextMenu && (
        <div
          className="fixed z-50 w-44 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 shadow-xl py-1"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button
            onClick={() => { onCloseTab(contextMenu.tabId); setContextMenu(null); }}
            className="w-full px-3 py-1.5 text-sm text-left text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800"
          >
            Close
          </button>
          <button
            onClick={() => { onCloseOthers(contextMenu.tabId); setContextMenu(null); }}
            disabled={tabs.length <= 1}
            className="w-full px-3 py-1.5 text-sm text-left text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-40 disabled:cursor-default"
          >
            Close others
          </button>
          <button
            onClick={() => { onCloseAll(); setContextMenu(null); }}
            className="w-full px-3 py-1.5 text-sm text-left text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800"
          >
            Close all
          </button>
        </div>
      )}
    </div>
  );
}
