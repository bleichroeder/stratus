"use client";

import { useEffect, useState, useCallback, useRef, Component, type ReactNode, type ErrorInfo } from "react";
import { Sidebar } from "@/components/sidebar/sidebar";
import { NoteEditor } from "@/components/editor/editor";
import { TabBar, type Tab } from "@/components/editor/tabs";
import { ArchivePanel } from "@/components/sidebar/archive-panel";
import { GraphPanel } from "@/components/graph/graph-panel";
import { CalendarPanel } from "@/components/calendar/calendar-panel";
import { formatDailyNoteTitle } from "@/lib/context-hints";
import { PromptModal, ConfirmModal } from "@/components/ui/modal";
import {
  getNotes,
  getNote,
  getArchivedNotes,
  createNote,
  updateNote,
  archiveNote,
  archiveNoteWithChildren,
  restoreNote,
  permanentlyDeleteNote,
  uploadImage,
  shareNote,
  unshareNote,
  getCollaborators,
  getSharedWithMeNotes,
  getCollaborativeNoteIds,
  getTemplates,
  createTemplate,
  deleteTemplate,
  renameTemplate,
  updateTemplateContextHint,
} from "@/lib/notes";
import type { NoteCollaborator } from "@/lib/types";
import { notifyPartyKitRoom } from "@/lib/yjs/notify";
import type { Note, Json, CalendarEvent } from "@/lib/types";
import {
  FileText,
  Menu,
  Loader2,
} from "lucide-react";
import { CommandPalette } from "@/components/command-palette/command-palette";
import { Welcome } from "@/components/onboarding/welcome";
import { LogoFull } from "@/components/ui/logo";
import { Dashboard } from "@/components/dashboard/dashboard";
import { TemplatePickerModal } from "@/components/templates/template-picker-modal";
import { TemplateManagerModal } from "@/components/templates/template-manager-modal";
import { getAllTemplates, buildTemplate, getBuiltinContextHint, type TemplateItem, type ContextHint, CONTEXT_HINT_NONE } from "@/lib/templates";
import { VaultProvider, useVault } from "@/components/vault/vault-context";
import { VaultSetupModal } from "@/components/vault/vault-setup-modal";
import { VaultUnlockModal } from "@/components/vault/vault-unlock-modal";
import { encryptContent, decryptContent, isEncryptedPayload } from "@/lib/crypto";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeNotes } from "@/lib/useRealtimeNotes";
import { useUnseenNotes } from "@/lib/useUnseenNotes";
import { useAI } from "@/lib/useAI";
import { tiptapToPlainText, plainTextToTiptapNodes, type ContextNoteInput } from "@/lib/ai";
import { AIFillBanner } from "@/components/ai/ai-fill-banner";
import { AIFillModal, type ContextNote } from "@/components/ai/ai-fill-modal";

function todayString(): string {
  return new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

class EditorErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[EditorErrorBoundary] Full stack:", error, info.componentStack);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center space-y-2">
            <p className="text-sm text-red-500">Editor crashed: {this.state.error.message}</p>
            <button onClick={() => this.setState({ error: null })} className="text-xs text-blue-500 underline">Retry</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function AppPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [archivedNotes, setArchivedNotes] = useState<Note[]>([]);
  const [showArchive, setShowArchive] = useState(false);
  const [showGraph, setShowGraph] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isOAuthOnlyUser, setIsOAuthOnlyUser] = useState(false);
  const [hasGoogle, setHasGoogle] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);

  // Collaboration state
  const [activeNoteCollaborators, setActiveNoteCollaborators] = useState<NoteCollaborator[]>([]);
  const [collabLoaded, setCollabLoaded] = useState(false);
  const [sharedWithMeNotes, setSharedWithMeNotes] = useState<Note[]>([]);
  const [collaborativeNoteIds, setCollaborativeNoteIds] = useState<Set<string>>(new Set());

  // Toast notification
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  function showToast(message: string) {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(message);
    toastTimerRef.current = setTimeout(() => setToast(null), 3000);
  }
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);

  // Calendar state
  const [preparingNoteForEventId, setPreparingNoteForEventId] = useState<string | null>(null);

  // Template state
  const [userTemplates, setUserTemplates] = useState<Note[]>([]);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [templatePickerMode, setTemplatePickerMode] = useState<"create" | "insert">("create");
  const [templateManagerOpen, setTemplateManagerOpen] = useState(false);
  const [templateParentId, setTemplateParentId] = useState<string | null>(null);
  const editorRef = useRef<{ insertContent: (content: Json) => void; setContent: (content: Json) => void } | null>(null);

  // AI state
  const { generate: aiGenerate, loading: aiLoading } = useAI();
  const [aiFillBanner, setAiFillBanner] = useState<{ show: boolean; templateId: string | null; contextHint: ContextHint }>({ show: false, templateId: null, contextHint: CONTEXT_HINT_NONE });
  const [aiFillModalOpen, setAiFillModalOpen] = useState(false);

  // Loading / feedback states
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);
  const [creatingNote, setCreatingNote] = useState(false);
  const [creatingDailyNote, setCreatingDailyNote] = useState(false);
  const [folderLoading, setFolderLoading] = useState(false);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [noteLoading, setNoteLoading] = useState(false);

  // Detect OAuth user and display name
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        const providers: string[] = user.app_metadata?.providers ?? [];
        const primaryProvider = user.app_metadata?.provider;
        // OAuth-only: signed up via Google, has no password
        setIsOAuthOnlyUser(primaryProvider !== "email");
        // Has Google linked (for calendar features)
        setHasGoogle(providers.includes("google"));
        const meta = user.user_metadata;
        const name = meta?.full_name ?? meta?.name ?? null;
        setUserName(name ?? user.email?.split("@")[0] ?? null);
        setCurrentUserId(user.id);
        setCurrentUserEmail(user.email ?? null);
      }
    });
  }, []);

  // Detect mobile
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    setIsMobile(mq.matches);
    function onChange(e: MediaQueryListEvent) {
      setIsMobile(e.matches);
      if (!e.matches) setMobileMenuOpen(false);
    }
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Modal state
  const [folderModal, setFolderModal] = useState<{ open: boolean; parentId: string | null }>({
    open: false,
    parentId: null,
  });
  const [archiveModal, setArchiveModal] = useState<{ open: boolean; noteId: string | null; isFolder: boolean }>({
    open: false,
    noteId: null,
    isFolder: false,
  });
  const [vaultSetupOpen, setVaultSetupOpen] = useState(false);
  const [vaultUnlockOpen, setVaultUnlockOpen] = useState(false);

  const { status: vaultStatus, vaultKey, vaultFolderId, setVaultFolderId, setupVault, unlock, lock, recoverVault, isInsideVault } = useVault();

  const loadNotes = useCallback(async () => {
    try {
      const data = await getNotes();
      setNotes(data);
    } catch (err) {
      console.error("Failed to load notes:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadArchived = useCallback(async () => {
    try {
      const data = await getArchivedNotes();
      setArchivedNotes(data);
    } catch (err) {
      console.error("Failed to load archived notes:", err);
    }
  }, []);

  useEffect(() => {
    loadNotes();
    getSharedWithMeNotes()
      .then(setSharedWithMeNotes)
      .catch(() => setSharedWithMeNotes([]));
    getCollaborativeNoteIds()
      .then((ids) => setCollaborativeNoteIds(new Set(ids)))
      .catch(() => setCollaborativeNoteIds(new Set()));
    getTemplates()
      .then(setUserTemplates)
      .catch(() => setUserTemplates([]));
  }, [loadNotes]);

  // Realtime: sync notes from external changes (MCP, other tabs, etc.)
  useRealtimeNotes(currentUserId, setNotes, activeTabId);
  const { unseenIds, markSeen } = useUnseenNotes(notes, activeTabId, currentUserId);

  useEffect(() => {
    loadArchived();
  }, [showArchive, loadArchived]);

  // Detect vault folder
  useEffect(() => {
    const vf = notes.find((n) => n.title === "__vault__" && n.is_folder && n.parent_id === null);
    setVaultFolderId(vf?.id ?? null);
  }, [notes, setVaultFolderId]);

  // Track which tab the AI fill banner was set for, so
  // repeated effect runs for the same tab don't clear it.
  const aiFillBannerTabId = useRef<string | null>(null);

  // Load note content when active tab changes
  useEffect(() => {
    let stale = false;
    setSaveStatus("idle");
    // Only clear the banner when switching to a genuinely different tab
    if (activeTabId !== aiFillBannerTabId.current) {
      setAiFillBanner({ show: false, templateId: null, contextHint: CONTEXT_HINT_NONE });
      setAiFillModalOpen(false);
      aiFillBannerTabId.current = null;
    }
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    if (!activeTabId) {
      setActiveNote(null);
      setNoteLoading(false);
      return;
    }
    setNoteLoading(true);
    setActiveNote(null);
    getNote(activeTabId).then(async (note) => {
      if (stale) return;
      if (!note) { setActiveNote(null); setNoteLoading(false); return; }
      // Decrypt if encrypted and vault is unlocked
      if (note.encrypted && vaultKey && isEncryptedPayload(note.content)) {
        try {
          const plaintext = await decryptContent(note.content, vaultKey);
          if (stale) return;
          setActiveNote({ ...note, content: JSON.parse(plaintext) });
        } catch {
          console.error("Failed to decrypt note");
          if (!stale) setActiveNote(null);
        }
      } else if (note.encrypted && !vaultKey) {
        // Vault locked — can't open
        setActiveNote(null);
      } else {
        setActiveNote(note);
      }
      if (!stale) setNoteLoading(false);
    });
    return () => { stale = true; };
  }, [activeTabId, vaultKey]);

  // Reset collaborators immediately when tab changes, then load new ones
  useEffect(() => {
    setActiveNoteCollaborators([]);
    setCollabLoaded(false);
    if (!activeTabId) {
      setCollabLoaded(true);
      return;
    }
    getCollaborators(activeTabId)
      .then((collabs) => {
        setActiveNoteCollaborators(collabs);
        // Track which notes have collaborators for sidebar badges
        setCollaborativeNoteIds((prev) => {
          const next = new Set(prev);
          if (collabs.length > 0) {
            next.add(activeTabId);
          } else {
            next.delete(activeTabId);
          }
          return next;
        });
      })
      .catch(() => setActiveNoteCollaborators([]))
      .finally(() => setCollabLoaded(true));
  }, [activeTabId]);

  // Sync tab titles when notes change
  useEffect(() => {
    setTabs((prev) =>
      prev.map((tab) => {
        const note = notes.find((n) => n.id === tab.id)
          ?? sharedWithMeNotes.find((n) => n.id === tab.id);
        return note ? { ...tab, title: note.title } : tab;
      })
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes]);

  function openTab(id: string) {
    // Look up title from all available note sources
    const note = notes.find((n) => n.id === id)
      ?? sharedWithMeNotes.find((n) => n.id === id);
    const title = note?.title ?? "Untitled";

    markSeen(id);
    setTabs((prev) => {
      if (prev.some((t) => t.id === id)) return prev;
      return [...prev, { id, title }];
    });
    setActiveTabId(id);
    if (isMobile) setMobileMenuOpen(false);
  }

  function closeTab(id: string) {
    const prev = tabs;
    const next = prev.filter((t) => t.id !== id);
    setTabs(next);
    if (activeTabId === id) {
      const idx = prev.findIndex((t) => t.id === id);
      const newActive = next[Math.min(idx, next.length - 1)] ?? null;
      setActiveTabId(newActive?.id ?? null);
      if (!newActive) setActiveNote(null);
    }
  }

  function closeOtherTabs(id: string) {
    setTabs((prev) => prev.filter((t) => t.id === id));
    setActiveTabId(id);
  }

  function closeAllTabs() {
    setTabs([]);
    setActiveTabId(null);
    setActiveNote(null);
  }

  const handleUpdateContent = useCallback(
    async (content: Json) => {
      if (!activeTabId) return;
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      setSaveStatus("saving");
      try {
        const note = notes.find((n) => n.id === activeTabId);
        let contentToSave: Json = content;
        if (note?.encrypted && vaultKey) {
          const encrypted = await encryptContent(JSON.stringify(content), vaultKey);
          contentToSave = encrypted as unknown as Json;
        }
        const updated = await updateNote(activeTabId, { content: contentToSave });
        // Keep decrypted content in local state
        setActiveNote((prev) => prev?.id === updated.id ? (note?.encrypted ? { ...updated, content } : updated) : prev);
        setNotes((prev) =>
          prev.map((n) => (n.id === updated.id ? updated : n))
        );
        setSaveStatus("saved");
        saveTimeoutRef.current = setTimeout(() => setSaveStatus("idle"), 2000);
      } catch (err) {
        console.error("Failed to save note:", err);
        setSaveStatus("idle");
      }
    },
    [activeTabId, notes, vaultKey]
  );

  const handleCreateNote = useCallback(
    async (parentId?: string | null) => {
      setCreatingNote(true);
      try {
        const inVault = parentId
          ? (parentId === vaultFolderId || isInsideVault(parentId, notes))
          : false;
        const note = await createNote({
          parent_id: parentId ?? null,
          is_folder: false,
          encrypted: inVault && vaultStatus === "unlocked",
        });
        setNotes((prev) => [note, ...prev]);
        setTabs((prev) => [...prev, { id: note.id, title: note.title }]);
        setActiveTabId(note.id);
      } catch (err) {
        console.error("Failed to create note:", err);
      } finally {
        setCreatingNote(false);
      }
    },
    [vaultFolderId, vaultStatus, isInsideVault, notes]
  );

  const handleCreateFromTemplate = useCallback(
    async (template: TemplateItem) => {
      setCreatingNote(true);
      try {
        // For built-in templates, generate fresh dynamic content (dates, env)
        const dynamic = template.builtIn ? buildTemplate(template.id) : null;
        const title = dynamic?.title ?? template.title;
        const content = (dynamic?.content ?? template.content) as Json;

        const parentId = templateParentId;
        const inVault = parentId
          ? (parentId === vaultFolderId || isInsideVault(parentId, notes))
          : false;
        const note = await createNote({
          title,
          content,
          parent_id: parentId,
          encrypted: inVault && vaultStatus === "unlocked",
        });
        setNotes((prev) => [note, ...prev]);
        setTabs((prev) => [...prev, { id: note.id, title: note.title }]);
        setTemplateParentId(null);
        // Show AI fill banner for templates — record the tab ID so the
        // tab-change effect knows not to clear the banner for this tab.
        const hint = template.builtIn
          ? getBuiltinContextHint(template.id)
          : template.contextHint;
        if (template.builtIn || hint.type !== "none") {
          aiFillBannerTabId.current = note.id;
          setAiFillBanner({ show: true, templateId: template.id, contextHint: hint });
        }
        setActiveTabId(note.id);
      } catch (err) {
        console.error("Failed to create note from template:", err);
      } finally {
        setCreatingNote(false);
      }
    },
    [templateParentId, vaultFolderId, vaultStatus, isInsideVault, notes]
  );

  const handleInsertTemplate = useCallback(
    (template: TemplateItem) => {
      const dynamic = template.builtIn ? buildTemplate(template.id) : null;
      const resolved = (dynamic?.content ?? template.content) as { content?: Json[] };
      if (editorRef.current && resolved?.content) {
        editorRef.current.insertContent({ type: "doc", content: resolved.content } as Json);
      }
    },
    []
  );

  const handleTemplateSelect = useCallback(
    (template: TemplateItem) => {
      if (templatePickerMode === "insert") {
        handleInsertTemplate(template);
      } else {
        handleCreateFromTemplate(template);
      }
    },
    [templatePickerMode, handleCreateFromTemplate, handleInsertTemplate]
  );

  const openTemplatePicker = useCallback(
    (mode: "create" | "insert" = "create", parentId: string | null = null) => {
      setTemplatePickerMode(mode);
      setTemplateParentId(parentId);
      setTemplatePickerOpen(true);
    },
    []
  );

  const handleSaveAsTemplate = useCallback(async () => {
    if (!activeNote) return;
    try {
      const template = await createTemplate({
        title: `${activeNote.title} (template)`,
        content: activeNote.content as Json,
      });
      setUserTemplates((prev) => [...prev, template]);
      showToast("Saved as template");
    } catch (err) {
      console.error("Failed to save template:", err);
    }
  }, [activeNote]);

  const handleDeleteTemplate = useCallback(async (id: string) => {
    try {
      await deleteTemplate(id);
      setUserTemplates((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      console.error("Failed to delete template:", err);
    }
  }, []);

  const handleRenameTemplate = useCallback(async (id: string, newTitle: string) => {
    try {
      await renameTemplate(id, newTitle);
      setUserTemplates((prev) =>
        prev.map((t) => (t.id === id ? { ...t, title: newTitle } : t))
      );
    } catch (err) {
      console.error("Failed to rename template:", err);
    }
  }, []);

  const handleTemplateContextHintChange = useCallback(async (id: string, hint: ContextHint) => {
    try {
      await updateTemplateContextHint(id, hint);
      setUserTemplates((prev) =>
        prev.map((t) => (t.id === id ? { ...t, context_hint: hint as unknown as Json } : t))
      );
    } catch (err) {
      console.error("Failed to update template context hint:", err);
    }
  }, []);

  // Listen for slash command template picker event
  useEffect(() => {
    function handleSlashTemplate() {
      openTemplatePicker("insert");
    }
    window.addEventListener("open-template-picker-insert", handleSlashTemplate);
    return () => window.removeEventListener("open-template-picker-insert", handleSlashTemplate);
  }, [openTemplatePicker]);

  // --- AI handlers ---

  const handleAIFill = useCallback(async (params: {
    contextNotes: ContextNote[];
    instructions?: string;
    templateId?: string;
  }) => {
    const templateId = params.templateId ?? aiFillBanner.templateId;
    if (!templateId) return;

    const contextNotes: ContextNoteInput[] = params.contextNotes.map((n) => ({
      title: n.title,
      content: n.content,
    }));

    const result = await aiGenerate({
      action: "template-fill",
      templateId,
      prompt: params.instructions,
      noteTitle: activeNote?.title,
      contextNotes: contextNotes.length > 0 ? contextNotes : undefined,
    });
    if (!result.ok) {
      showToast(result.error);
      return;
    }
    const nodes = plainTextToTiptapNodes(result.text);

    // Append wiki links to context notes if any were used
    if (params.contextNotes.length > 0) {
      nodes.push(
        { type: "horizontalRule" },
        {
          type: "heading",
          attrs: { level: 3 },
          content: [{ type: "text", text: "Context" }],
        },
        {
          type: "bulletList",
          content: params.contextNotes.map((n) => ({
            type: "listItem",
            content: [{
              type: "paragraph",
              content: [{
                type: "text",
                text: n.title,
                marks: [{
                  type: "wikiLink",
                  attrs: { noteId: n.id, title: n.title },
                }],
              }],
            }],
          })),
        } as Json,
      );
    }

    if (editorRef.current && nodes.length > 0) {
      editorRef.current.setContent({ type: "doc", content: nodes } as Json);
    }
    setAiFillBanner({ show: false, templateId: null, contextHint: CONTEXT_HINT_NONE });
    setAiFillModalOpen(false);
  }, [aiGenerate, activeNote, aiFillBanner.templateId]);

  const handleSummarize = useCallback(async () => {
    if (!activeNote?.content) return;
    const plainText = tiptapToPlainText(activeNote.content);
    if (!plainText.trim()) {
      showToast("Note is empty — nothing to summarize");
      return;
    }
    const result = await aiGenerate({
      action: "summarize",
      context: plainText,
      noteTitle: activeNote.title,
    });
    if (!result.ok) {
      showToast(result.error);
      return;
    }
    const nodes = plainTextToTiptapNodes(result.text);
    if (editorRef.current && nodes.length > 0) {
      editorRef.current.insertContent({
        type: "doc",
        content: [
          { type: "horizontalRule" },
          {
            type: "heading",
            attrs: { level: 3 },
            content: [{ type: "text", text: "Summary" }],
          },
          ...nodes,
          { type: "horizontalRule" },
        ],
      } as Json);
    }
  }, [aiGenerate, activeNote]);

  const handleCreateFolder = useCallback(
    (parentId?: string | null) => {
      setFolderModal({ open: true, parentId: parentId ?? null });
    },
    []
  );

  const handleFolderSubmit = useCallback(
    async (name: string) => {
      setFolderLoading(true);
      try {
        const folder = await createNote({
          title: name,
          parent_id: folderModal.parentId,
          is_folder: true,
        });
        setNotes((prev) => [folder, ...prev]);
        setFolderModal({ open: false, parentId: null });
      } catch (err) {
        console.error("Failed to create folder:", err);
      } finally {
        setFolderLoading(false);
      }
    },
    [folderModal.parentId]
  );

  const handleDeleteNote = useCallback(
    (id: string) => {
      if (id === vaultFolderId) return; // Can't archive vault folder
      const note = notes.find((n) => n.id === id);
      setArchiveModal({ open: true, noteId: id, isFolder: note?.is_folder ?? false });
    },
    [notes, vaultFolderId]
  );

  const handleArchiveConfirm = useCallback(async () => {
    if (!archiveModal.noteId) return;
    const id = archiveModal.noteId;
    setArchiveLoading(true);
    try {
      if (archiveModal.isFolder) {
        const archivedIds = await archiveNoteWithChildren(id, notes);
        setNotes((prev) => prev.filter((n) => !archivedIds.includes(n.id)));
        // Close any tabs for archived notes
        setTabs((prev) => prev.filter((t) => !archivedIds.includes(t.id)));
        if (archivedIds.includes(activeTabId ?? "")) {
          setActiveTabId(null);
          setActiveNote(null);
        }
      } else {
        await archiveNote(id);
        setNotes((prev) => prev.filter((n) => n.id !== id));
        closeTab(id);
        // Notify PartyKit room so collaborators disconnect
        notifyPartyKitRoom(id, { type: "note-archived" });
      }
      setArchiveModal({ open: false, noteId: null, isFolder: false });
    } catch (err) {
      console.error("Failed to archive note:", err);
    } finally {
      setArchiveLoading(false);
    }
  }, [archiveModal.noteId, archiveModal.isFolder, activeTabId, notes]);

  const handleDeleteMultiple = useCallback(async (ids: string[]) => {
    try {
      for (const id of ids) {
        const note = notes.find((n) => n.id === id);
        if (note?.is_folder) {
          await archiveNoteWithChildren(id, notes);
        } else {
          await archiveNote(id);
        }
      }
      // Collect all IDs that were archived (including all descendants)
      const allArchivedIds = new Set<string>();
      function collectAll(parentId: string) {
        allArchivedIds.add(parentId);
        for (const child of notes.filter((n) => n.parent_id === parentId)) {
          collectAll(child.id);
        }
      }
      for (const id of ids) {
        collectAll(id);
      }
      setNotes((prev) => prev.filter((n) => !allArchivedIds.has(n.id)));
      setTabs((prev) => prev.filter((t) => !allArchivedIds.has(t.id)));
      if (activeTabId && allArchivedIds.has(activeTabId)) {
        setActiveTabId(null);
        setActiveNote(null);
      }
    } catch (err) {
      console.error("Failed to archive notes:", err);
    }
  }, [notes, activeTabId]);

  const handleRestore = useCallback(async (id: string) => {
    try {
      const restored = await restoreNote(id);
      setArchivedNotes((prev) => prev.filter((n) => n.id !== id));
      setNotes((prev) => [restored, ...prev]);
    } catch (err) {
      console.error("Failed to restore note:", err);
    }
  }, []);

  const handlePermanentDelete = useCallback(async (id: string) => {
    try {
      await permanentlyDeleteNote(id);
      setArchivedNotes((prev) => prev.filter((n) => n.id !== id));
    } catch (err) {
      console.error("Failed to permanently delete note:", err);
    }
  }, []);

  const handlePermanentDeleteAll = useCallback(async () => {
    try {
      for (const note of archivedNotes) {
        await permanentlyDeleteNote(note.id);
      }
      setArchivedNotes([]);
    } catch (err) {
      console.error("Failed to delete all archived notes:", err);
    }
  }, [archivedNotes]);

  // Helper: recursively collect all descendant IDs
  function collectDescendants(parentId: string): string[] {
    const ids: string[] = [];
    const children = notes.filter((n) => n.parent_id === parentId);
    for (const child of children) {
      ids.push(child.id);
      ids.push(...collectDescendants(child.id));
    }
    return ids;
  }

  const handleMoveNote = useCallback(
    async (noteId: string, newParentId: string | null) => {
      try {
        const sourceNote = notes.find((n) => n.id === noteId);
        if (!sourceNote) return;

        // Block moving shared notes into vault
        if (sourceNote.shared_token) {
          const targetIsVault = newParentId === vaultFolderId || (newParentId !== null && isInsideVault(newParentId, notes));
          if (targetIsVault) {
            showToast("Shared notes cannot be moved to the vault");
            return;
          }
        }

        // Block moving collaborative notes into vault
        const targetIsVaultForCollab = newParentId === vaultFolderId || (newParentId !== null && isInsideVault(newParentId, notes));
        if (targetIsVaultForCollab) {
          try {
            const collabs = await getCollaborators(noteId);
            if (collabs.length > 0) {
              showToast("Collaborative notes cannot be moved to the vault");
              return;
            }
          } catch {
            // If we can't check, allow the move
          }
        }

        const targetIsVault = newParentId === vaultFolderId || (newParentId !== null && isInsideVault(newParentId, notes));
        const sourceIsVault = isInsideVault(noteId, notes);

        if (targetIsVault && !sourceNote.encrypted && vaultKey) {
          // Moving INTO vault — encrypt this note and all descendants
          if (!sourceNote.is_folder) {
            const plaintext = JSON.stringify(sourceNote.content ?? null);
            const encrypted = await encryptContent(plaintext, vaultKey);
            const updated = await updateNote(noteId, {
              parent_id: newParentId,
              content: encrypted as unknown as Json,
              encrypted: true,
            });
            setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
          } else {
            // Move the folder first
            const updated = await updateNote(noteId, { parent_id: newParentId, encrypted: true });
            setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
            // Encrypt all descendant notes
            const descendants = collectDescendants(noteId);
            for (const descId of descendants) {
              const desc = notes.find((n) => n.id === descId);
              if (desc && !desc.is_folder && !desc.encrypted) {
                const plaintext = JSON.stringify(desc.content ?? null);
                const enc = await encryptContent(plaintext, vaultKey);
                const upd = await updateNote(descId, { content: enc as unknown as Json, encrypted: true });
                setNotes((prev) => prev.map((n) => (n.id === upd.id ? upd : n)));
              }
            }
          }
        } else if (!targetIsVault && sourceIsVault && sourceNote.encrypted && vaultKey) {
          // Moving OUT of vault — decrypt this note and all descendants
          if (!sourceNote.is_folder) {
            let content = sourceNote.content;
            if (isEncryptedPayload(content)) {
              try {
                const plaintext = await decryptContent(content, vaultKey);
                content = JSON.parse(plaintext);
              } catch {
                console.error("Failed to decrypt note during move");
                return;
              }
            }
            const updated = await updateNote(noteId, { parent_id: newParentId, content, encrypted: false });
            setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
          } else {
            const updated = await updateNote(noteId, { parent_id: newParentId, encrypted: false });
            setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
            const descendants = collectDescendants(noteId);
            for (const descId of descendants) {
              const desc = notes.find((n) => n.id === descId);
              if (desc && !desc.is_folder && desc.encrypted && isEncryptedPayload(desc.content)) {
                try {
                  const plaintext = await decryptContent(desc.content, vaultKey);
                  const content = JSON.parse(plaintext);
                  const upd = await updateNote(descId, { content, encrypted: false });
                  setNotes((prev) => prev.map((n) => (n.id === upd.id ? upd : n)));
                } catch {
                  console.error(`Failed to decrypt descendant ${descId}`);
                }
              }
            }
          }
        } else {
          // Normal move
          const updated = await updateNote(noteId, { parent_id: newParentId });
          setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
        }
      } catch (err) {
        console.error("Failed to move note:", err);
      }
    },
    [notes, vaultKey, vaultFolderId, isInsideVault]
  );

  const handleRenameNote = useCallback(
    async (id: string, title: string) => {
      if (id === vaultFolderId) return; // Can't rename vault folder
      try {
        const updated = await updateNote(id, { title });
        setNotes((prev) =>
          prev.map((n) => (n.id === updated.id ? updated : n))
        );
        if (activeTabId === id) {
          setActiveNote((prev) => (prev ? { ...prev, title } : prev));
        }
      } catch (err) {
        console.error("Failed to rename note:", err);
      }
    },
    [activeTabId]
  );

  const dailyNoteInFlight = useRef(false);

  const handleDailyNoteForDate = useCallback(async (targetDate: Date) => {
    // Guard against concurrent calls
    if (dailyNoteInFlight.current) return;
    dailyNoteInFlight.current = true;
    setCreatingDailyNote(true);

    const title = formatDailyNoteTitle(targetDate);
    const yearStr = String(targetDate.getFullYear());
    const monthStr = targetDate.toLocaleDateString("en-US", { month: "long" });

    // Check if today's daily note already exists anywhere
    const existing = notes.find(
      (n) => n.title === title && !n.is_folder
    );
    if (existing) {
      openTab(existing.id);
      setCreatingDailyNote(false);
      dailyNoteInFlight.current = false;
      return;
    }

    // Query the database for existing folders to avoid duplicates.
    // Client-side state may be stale (e.g. folders created by MCP tools).
    const supabase = createClient();
    const { data: allFolders } = await supabase
      .from("notes")
      .select("id, title, parent_id")
      .eq("is_folder", true)
      .is("archived_at", null)
      .in("title", ["Daily Notes", yearStr, monthStr]);
    const dbFolders = allFolders ?? [];

    // Also check DB for existing daily note (may have been created by MCP)
    const { data: existingNote } = await supabase
      .from("notes")
      .select("id, title")
      .eq("title", title)
      .eq("is_folder", false)
      .is("archived_at", null)
      .maybeSingle();

    if (existingNote) {
      // Note exists in DB but not in client state — refresh and open
      const fullNote = await getNote(existingNote.id);
      if (fullNote) {
        setNotes((prev) => prev.some((n) => n.id === fullNote.id) ? prev : [fullNote, ...prev]);
        openTab(fullNote.id);
      }
      setCreatingDailyNote(false);
      dailyNoteInFlight.current = false;
      return;
    }

    const created: Note[] = [];

    // Find or create "Daily Notes" root folder
    let rootFolder = dbFolders.find(
      (f) => f.title === "Daily Notes" && f.parent_id === null
    ) as Note | undefined;
    if (!rootFolder) {
      try {
        rootFolder = await createNote({
          title: "Daily Notes",
          is_folder: true,
          parent_id: null,
        });
        created.push(rootFolder);
      } catch (err) {
        console.error("Failed to create Daily Notes folder:", err);
        setCreatingDailyNote(false);
        dailyNoteInFlight.current = false;
        return;
      }
    }

    // Find or create year subfolder (e.g. "2026")
    let yearFolder = dbFolders.find(
      (f) => f.title === yearStr && f.parent_id === rootFolder!.id
    ) as Note | undefined;
    if (!yearFolder) {
      try {
        yearFolder = await createNote({
          title: yearStr,
          is_folder: true,
          parent_id: rootFolder.id,
        });
        created.push(yearFolder);
      } catch (err) {
        console.error("Failed to create year folder:", err);
        setCreatingDailyNote(false);
        dailyNoteInFlight.current = false;
        return;
      }
    }

    // Find or create month subfolder (e.g. "March")
    let monthFolder = dbFolders.find(
      (f) => f.title === monthStr && f.parent_id === yearFolder!.id
    ) as Note | undefined;
    if (!monthFolder) {
      try {
        monthFolder = await createNote({
          title: monthStr,
          is_folder: true,
          parent_id: yearFolder.id,
        });
        created.push(monthFolder);
      } catch (err) {
        console.error("Failed to create month folder:", err);
        setCreatingDailyNote(false);
        dailyNoteInFlight.current = false;
        return;
      }
    }

    // Create today's note inside the month folder
    try {
      const dailyNote = await createNote({
        title,
        parent_id: monthFolder.id,
        is_folder: false,
      });
      // Batch all new items into state at once
      setNotes((prev) => {
        const existingIds = new Set(prev.map((n) => n.id));
        const newItems = [dailyNote, ...created].filter((n) => !existingIds.has(n.id));
        return [...newItems, ...prev];
      });
      setTabs((prev) => [...prev, { id: dailyNote.id, title: dailyNote.title }]);
      setActiveTabId(dailyNote.id);
    } catch (err) {
      console.error("Failed to create daily note:", err);
      if (created.length > 0) {
        setNotes((prev) => {
          const existingIds = new Set(prev.map((n) => n.id));
          const newItems = created.filter((n) => !existingIds.has(n.id));
          return [...newItems, ...prev];
        });
      }
    } finally {
      setCreatingDailyNote(false);
      dailyNoteInFlight.current = false;
    }
  }, [notes]);

  const handleDailyNote = useCallback(() => {
    handleDailyNoteForDate(new Date());
  }, [handleDailyNoteForDate]);

  const preparingMeetingRef = useRef(false);
  const handlePrepareMeetingNote = useCallback(async (event: CalendarEvent) => {
    // Guard against double-clicks / concurrent calls
    if (preparingMeetingRef.current) return;
    preparingMeetingRef.current = true;
    setPreparingNoteForEventId(event.id);
    try {
      const noteTitle = `${event.title} – ${new Date(event.startTime).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })}`;

      // Fetch fresh notes to avoid stale state race conditions
      const freshNotes = await getNotes();

      // Check if note already exists
      const existing = freshNotes.find((n) => n.title === noteTitle && !n.is_folder);
      if (existing) {
        openTab(existing.id);
        return;
      }

      // Find or create "Meeting Notes" folder
      let meetingFolder = freshNotes.find(
        (n) => n.title === "Meeting Notes" && n.is_folder && n.parent_id === null
      );
      let createdFolder = false;
      if (!meetingFolder) {
        meetingFolder = await createNote({
          title: "Meeting Notes",
          is_folder: true,
          parent_id: null,
        });
        createdFolder = true;
      }

      // Find previous notes from the same recurring meeting series
      type DocNode = { type: string; attrs?: Record<string, Json>; content?: DocNode[]; marks?: Json[] };
      let previousMeetingNotes: { id: string; title: string }[] = [];
      let carryForwardTasks: DocNode[] = [];

      if (event.recurringEventId) {
        // Find notes in Meeting Notes folder that have matching recurringEventId in their meetingMeta
        const candidateNotes = freshNotes.filter(
          (n) => !n.is_folder && n.parent_id === meetingFolder!.id && n.title.startsWith(event.title)
        );

        for (const candidate of candidateNotes) {
          const full = await getNote(candidate.id);
          if (!full?.content) continue;
          const doc = full.content as { type?: string; content?: DocNode[] };
          if (doc?.type !== "doc" || !Array.isArray(doc.content)) continue;

          const meta = doc.content.find((node: DocNode) => node.type === "meetingMeta");
          if (meta?.attrs?.recurringEventId === event.recurringEventId) {
            previousMeetingNotes.push({ id: candidate.id, title: candidate.title });

            // Extract unchecked tasks from the most recent previous note
            if (carryForwardTasks.length === 0) {
              for (const node of doc.content) {
                if (node.type === "taskList" && Array.isArray(node.content)) {
                  const unchecked = node.content.filter(
                    (item: DocNode) => item.type === "taskItem" && item.attrs?.checked === false
                      && item.content?.some((c: DocNode) =>
                        c.type === "paragraph" && Array.isArray(c.content) && c.content.length > 0
                      )
                  );
                  carryForwardTasks.push(...unchecked);
                }
              }
            }
          }
        }

        // Sort by title (which contains dates) descending so most recent is first
        previousMeetingNotes.sort((a, b) => b.title.localeCompare(a.title));
      }

      // Build pre-populated TipTap content
      const startTime = new Date(event.startTime).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      });
      const endTime = new Date(event.endTime).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      });
      const attendeeList = event.attendees
        .filter((a) => !a.self)
        .map((a) => a.displayName || a.email);

      const contentNodes: Json[] = [
        // Hidden metadata node for recurring meeting tracking
        {
          type: "meetingMeta",
          attrs: {
            eventId: event.id,
            recurringEventId: event.recurringEventId ?? null,
            date: event.startTime,
          },
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: event.title }],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", marks: [{ type: "bold" }], text: "Time: " },
            { type: "text", text: `${startTime} – ${endTime}` },
          ],
        },
      ];

      if (attendeeList.length > 0) {
        contentNodes.push({
          type: "paragraph",
          content: [
            { type: "text", marks: [{ type: "bold" }], text: "Attendees: " },
            { type: "text", text: attendeeList.join(", ") },
          ],
        });
      }

      if (event.meetingLink) {
        contentNodes.push({
          type: "paragraph",
          content: [
            { type: "text", marks: [{ type: "bold" }], text: "Meeting link: " },
            {
              type: "text",
              marks: [{ type: "link", attrs: { href: event.meetingLink } }],
              text: event.meetingLink,
            },
          ],
        });
      }

      // Previous meeting notes links
      if (previousMeetingNotes.length > 0) {
        contentNodes.push({
          type: "paragraph",
          content: [
            { type: "text", marks: [{ type: "bold" }], text: "Previous notes: " },
            ...previousMeetingNotes.flatMap((prev, i) => {
              const nodes: Json[] = [
                {
                  type: "text",
                  marks: [{ type: "link", attrs: { href: `#note:${prev.id}` } }],
                  text: prev.title,
                },
              ];
              if (i < previousMeetingNotes.length - 1) {
                nodes.push({ type: "text", text: ", " });
              }
              return nodes;
            }),
          ],
        });
      }

      contentNodes.push(
        { type: "horizontalRule" },
        {
          type: "heading",
          attrs: { level: 3 },
          content: [{ type: "text", text: "Notes" }],
        },
        { type: "paragraph" },
      );

      // Carry forward unchecked action items from previous meeting
      if (carryForwardTasks.length > 0) {
        contentNodes.push(
          {
            type: "heading",
            attrs: { level: 3 },
            content: [{ type: "text", text: "Carried Over" }],
          },
          {
            type: "taskList",
            content: carryForwardTasks as Json[],
          },
        );
      }

      contentNodes.push(
        {
          type: "heading",
          attrs: { level: 3 },
          content: [{ type: "text", text: "Action Items" }],
        },
        {
          type: "taskList",
          content: [
            {
              type: "taskItem",
              attrs: { checked: false },
              content: [{ type: "paragraph" }],
            },
          ],
        }
      );

      const content: Json = { type: "doc", content: contentNodes };

      const meetingNote = await createNote({
        title: noteTitle,
        content,
        parent_id: meetingFolder.id,
        is_folder: false,
      });
      // Use freshNotes as the base to avoid duplicates from stale state
      setNotes([meetingNote, ...(createdFolder ? [meetingFolder!] : []), ...freshNotes]);
      setTabs((prev) => [...prev, { id: meetingNote.id, title: meetingNote.title }]);

      // Show AI fill banner for the new meeting note
      aiFillBannerTabId.current = meetingNote.id;
      setAiFillBanner({ show: true, templateId: "builtin-meeting-notes", contextHint: { type: "daily_recent", days: 3 } });

      setActiveTabId(meetingNote.id);
    } catch (err) {
      console.error("Failed to create meeting note:", err);
    } finally {
      setPreparingNoteForEventId(null);
      preparingMeetingRef.current = false;
    }
  }, [openTab]);

  const handleShare = useCallback(async (): Promise<string> => {
    if (!activeTabId) throw new Error("No active note");
    const { token, shared_at } = await shareNote(activeTabId);
    setNotes((prev) =>
      prev.map((n) => (n.id === activeTabId ? { ...n, shared_token: token, shared_at } : n))
    );
    setActiveNote((prev) => (prev ? { ...prev, shared_token: token, shared_at } : prev));
    return token;
  }, [activeTabId]);

  const handleUnshare = useCallback(async () => {
    if (!activeTabId) return;
    await unshareNote(activeTabId);
    setNotes((prev) =>
      prev.map((n) => (n.id === activeTabId ? { ...n, shared_token: null, shared_at: null } : n))
    );
    setActiveNote((prev) => (prev ? { ...prev, shared_token: null, shared_at: null } : prev));
  }, [activeTabId]);

  const handleVaultClick = useCallback(() => {
    if (vaultStatus === "uninitialized") {
      setVaultSetupOpen(true);
    } else if (vaultStatus === "locked") {
      setVaultUnlockOpen(true);
    }
    // If unlocked, sidebar handles expand/collapse
  }, [vaultStatus]);

  const handleVaultSetup = useCallback(async (password: string): Promise<string> => {
    const supabase = (await import("@/lib/supabase/client")).createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) throw new Error("Not authenticated");

    // Only verify password for email/password users — OAuth-only users are creating a new vault password
    if (!isOAuthOnlyUser) {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password,
      });
      if (authError) throw new Error("Incorrect password");
    }

    const recoveryKey = await setupVault(password);
    // Create vault folder if it doesn't exist
    if (!vaultFolderId) {
      const folder = await createNote({ title: "__vault__", is_folder: true, parent_id: null });
      setNotes((prev) => [folder, ...prev]);
    }
    return recoveryKey;
  }, [setupVault, vaultFolderId, isOAuthOnlyUser]);

  const handleImageUpload = useCallback(async (file: File) => {
    const isCollab = activeNoteCollaborators.length > 0;
    return uploadImage(file, isCollab ? { noteId: activeTabId ?? undefined, isCollaborative: true } : undefined);
  }, [activeNoteCollaborators, activeTabId]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center w-full bg-white dark:bg-stone-950">
        <div className="flex flex-col items-center gap-3">
          <LogoFull size={32} />
          <Loader2 size={16} className="animate-spin text-stone-300 dark:text-stone-600" />
        </div>
      </div>
    );
  }

  return (
    <>
      <Sidebar
        notes={notes}
        activeNoteId={activeTabId}
        onSelectNote={openTab}
        onCreateNote={handleCreateNote}
        onCreateFolder={handleCreateFolder}
        onCreateFromTemplate={(parentId) => openTemplatePicker("create", parentId)}
        onDeleteNote={handleDeleteNote}
        onDeleteMultiple={handleDeleteMultiple}
        onMoveNote={handleMoveNote}
        onRenameNote={handleRenameNote}
        onDailyNote={handleDailyNote}
        showArchive={showArchive}
        onToggleArchive={() => setShowArchive((v) => !v)}
        archiveCount={archivedNotes.length}
        showGraph={showGraph}
        onToggleGraph={() => { setShowGraph((v) => !v); setShowCalendar(false); }}
        showCalendar={showCalendar}
        onToggleCalendar={() => { setShowCalendar((v) => !v); setShowGraph(false); }}
        isMobile={isMobile}
        mobileMenuOpen={mobileMenuOpen}
        onCloseMobileMenu={() => setMobileMenuOpen(false)}
        vaultStatus={vaultStatus}
        vaultFolderId={vaultFolderId}
        onVaultClick={handleVaultClick}
        onVaultLock={lock}
        creatingNote={creatingNote}
        creatingDailyNote={creatingDailyNote}
        sharedWithMeNotes={sharedWithMeNotes}
        collaborativeNoteIds={collaborativeNoteIds}
        unseenNoteIds={unseenIds}
      />

      <main className="flex-1 flex flex-col overflow-hidden relative">
        {showArchive && (
          <ArchivePanel
            notes={archivedNotes}
            onRestore={handleRestore}
            onPermanentDelete={handlePermanentDelete}
            onPermanentDeleteAll={handlePermanentDeleteAll}
            onClose={() => setShowArchive(false)}
          />
        )}
        {showCalendar ? (
          <CalendarPanel
            notes={notes}
            onSelectNote={openTab}
            onDailyNote={handleDailyNoteForDate}
            onClose={() => setShowCalendar(false)}
          />
        ) : showGraph ? (
          <GraphPanel notes={notes} onSelectNote={openTab} onClose={() => setShowGraph(false)} />
        ) : (
          <>
            {isMobile && (
              <div className="flex items-center gap-2 px-3 py-2 border-b border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-950">
                <button
                  onClick={() => setMobileMenuOpen(true)}
                  className="p-1.5 rounded-md hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-400"
                >
                  <Menu size={18} />
                </button>
                {activeNote ? (
                  <span className="text-sm font-medium text-stone-900 dark:text-stone-100 truncate">
                    {activeNote.title}
                  </span>
                ) : (
                  <LogoFull size={18} />
                )}
              </div>
            )}
            <TabBar
              tabs={tabs}
              activeTabId={activeTabId}
              onSelectTab={setActiveTabId}
              onCloseTab={closeTab}
              onCloseOthers={closeOtherTabs}
              onCloseAll={closeAllTabs}
              onRenameNote={handleRenameNote}
            />
            {noteLoading || (activeNote && !collabLoaded) ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 size={20} className="animate-spin text-stone-300 dark:text-stone-700" />
              </div>
            ) : activeNote ? (
              <EditorErrorBoundary>
              <NoteEditor
                noteId={activeNote.id}
                content={activeNote.content}
                onUpdate={handleUpdateContent}
                onImageUpload={handleImageUpload}
                notes={notes}
                onSelectNote={openTab}
                sharedToken={activeNote.shared_token}
                sharedAt={activeNote.shared_at}
                isEncrypted={activeNote.encrypted}
                onShare={handleShare}
                onUnshare={handleUnshare}
                saveStatus={saveStatus}
                editorRef={editorRef}
                onSummarize={handleSummarize}
                aiLoading={aiLoading}
                bannerSlot={aiFillBanner.show && aiFillBanner.templateId ? (
                  <AIFillBanner
                    loading={aiLoading}
                    onFill={() => setAiFillModalOpen(true)}
                    onDismiss={() => setAiFillBanner({ show: false, templateId: null, contextHint: CONTEXT_HINT_NONE })}
                  />
                ) : undefined}
                isCollaborative={activeNoteCollaborators.length > 0 && !!process.env.NEXT_PUBLIC_PARTYKIT_HOST}
                collaboratorRole={
                  activeNote.user_id === currentUserId
                    ? "owner"
                    : activeNoteCollaborators.find((c) => c.user_id === currentUserId)?.role ?? null
                }
                currentUserId={currentUserId ?? undefined}
                currentUserEmail={currentUserEmail ?? undefined}
                currentUserDisplayName={userName ?? undefined}
                isOwner={activeNote.user_id === currentUserId}
                isInsideVault={isInsideVault(activeNote.id, notes)}
                collaborators={activeNoteCollaborators}
                onCollaboratorsChange={(collabs) => {
                  setActiveNoteCollaborators(collabs);
                  setCollaborativeNoteIds((prev) => {
                    const next = new Set(prev);
                    if (collabs.length > 0) next.add(activeNote.id);
                    else next.delete(activeNote.id);
                    return next;
                  });
                }}
              />
              </EditorErrorBoundary>
            ) : notes.length === 0 ? (
              <Welcome
                onCreateNote={() => handleCreateNote()}
                onDailyNote={handleDailyNote}
              />
            ) : (
              <Dashboard
                notes={notes}
                onSelectNote={openTab}
                onCreateNote={() => handleCreateNote()}
                onDailyNote={handleDailyNote}
                onNewFromTemplate={() => openTemplatePicker("create")}
                creatingNote={creatingNote}
                creatingDailyNote={creatingDailyNote}
                vaultStatus={vaultStatus}
                onVaultUnlock={handleVaultClick}
                userName={userName}
                isGoogleUser={hasGoogle}
                onPrepareMeetingNote={handlePrepareMeetingNote}
                preparingNoteForEventId={preparingNoteForEventId}
                collaborativeNoteIds={collaborativeNoteIds}
                sharedWithMeNotes={sharedWithMeNotes}
              />
            )}
          </>
        )}
      </main>

      <PromptModal
        open={folderModal.open}
        onClose={() => setFolderModal({ open: false, parentId: null })}
        onSubmit={handleFolderSubmit}
        title="New folder"
        placeholder="Folder name"
        submitLabel="Create"
        loading={folderLoading}
      />

      <CommandPalette
        notes={notes}
        onSelectNote={openTab}
        onCreateNote={() => handleCreateNote()}
        onCreateFolder={() => handleCreateFolder()}
        onDailyNote={handleDailyNote}
        onCloseAllTabs={closeAllTabs}
        onNewFromTemplate={() => openTemplatePicker("create")}
        onSaveAsTemplate={activeNote ? handleSaveAsTemplate : undefined}
        onSummarize={activeNote ? handleSummarize : undefined}
      />

      <ConfirmModal
        open={archiveModal.open}
        onClose={() => setArchiveModal({ open: false, noteId: null, isFolder: false })}
        onConfirm={handleArchiveConfirm}
        title={archiveModal.isFolder ? "Archive folder" : "Archive note"}
        message={
          archiveModal.isFolder
            ? "This folder and all its contents will be moved to the archive. Items are automatically deleted after 7 days."
            : "This note will be moved to the archive. It will be automatically deleted after 7 days."
        }
        confirmLabel="Archive"
        danger
        loading={archiveLoading}
      />

      <TemplatePickerModal
        open={templatePickerOpen}
        onClose={() => { setTemplatePickerOpen(false); setTemplateParentId(null); }}
        onSelect={handleTemplateSelect}
        templates={getAllTemplates(userTemplates)}
        onManage={() => setTemplateManagerOpen(true)}
        mode={templatePickerMode}
      />

      <TemplateManagerModal
        open={templateManagerOpen}
        onClose={() => setTemplateManagerOpen(false)}
        templates={getAllTemplates(userTemplates)}
        onDelete={handleDeleteTemplate}
        onRename={handleRenameTemplate}
        onContextHintChange={handleTemplateContextHintChange}
      />

      <VaultSetupModal
        open={vaultSetupOpen}
        onClose={() => setVaultSetupOpen(false)}
        onSetup={handleVaultSetup}
        isOAuthUser={isOAuthOnlyUser}
      />

      <VaultUnlockModal
        open={vaultUnlockOpen}
        onClose={() => setVaultUnlockOpen(false)}
        onUnlock={unlock}
        onRecover={recoverVault}
        isOAuthUser={isOAuthOnlyUser}
      />

      {/* AI Fill Modal (context-aware template filling) */}
      {aiFillBanner.templateId && (
        <AIFillModal
          open={aiFillModalOpen}
          onClose={() => setAiFillModalOpen(false)}
          templateId={aiFillBanner.templateId}
          contextHint={aiFillBanner.contextHint}
          onGenerate={handleAIFill}
          loading={aiLoading}
        />
      )}

      {/* Toast notification */}
      {toast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-sm shadow-lg animate-[fadeIn_150ms_ease-out]">
          {toast}
        </div>
      )}
    </>
  );
}
