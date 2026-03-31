"use client";

import { type Editor, useEditorState } from "@tiptap/react";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  List,
  ListOrdered,
  ListTodo,
  Quote,
  Heading1,
  Heading2,
  Heading3,
  CodeSquare,
  Link as LinkIcon,
  Image as ImageIcon,
  Undo,
  Redo,
  Minus,
  Sparkles,
} from "lucide-react";
import { useState, useEffect } from "react";
import { PromptModal, ImageUploadModal } from "@/components/ui/modal";

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia("(max-width: 767px)");
    setIsMobile(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);
  return isMobile;
}

interface EditorToolbarProps {
  editor: Editor | null;
  onImageUpload?: (file: File) => Promise<string | null>;
  disabled?: boolean;
  onSummarize?: () => void;
  aiLoading?: boolean;
}

function ToolbarButton({
  onClick,
  active = false,
  disabled = false,
  children,
  title,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  title: string;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-2.5 md:p-1.5 rounded-lg md:rounded hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors shrink-0 ${
        active ? "bg-stone-200 dark:bg-stone-700 text-stone-900 dark:text-stone-100" : "text-stone-600 dark:text-stone-400"
      } ${disabled ? "opacity-30 cursor-not-allowed" : ""}`}
    >
      {children}
    </button>
  );
}

function Separator() {
  return <div className="w-px h-5 bg-stone-300 dark:bg-stone-600 mx-0.5 md:mx-1 shrink-0" />;
}

export function EditorToolbar({ editor, onImageUpload, disabled = false, onSummarize, aiLoading = false }: EditorToolbarProps) {
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkDefault, setLinkDefault] = useState("");
  const [imageModalOpen, setImageModalOpen] = useState(false);

  const editorState = useEditorState({
    editor,
    selector: (ctx: { editor: Editor | null }) => {
      if (!ctx.editor) return null;
      return {
        canUndo: ctx.editor.can().undo(),
        canRedo: ctx.editor.can().redo(),
        isBold: ctx.editor.isActive("bold"),
        isItalic: ctx.editor.isActive("italic"),
        isUnderline: ctx.editor.isActive("underline"),
        isStrike: ctx.editor.isActive("strike"),
        isCode: ctx.editor.isActive("code"),
        isH1: ctx.editor.isActive("heading", { level: 1 }),
        isH2: ctx.editor.isActive("heading", { level: 2 }),
        isH3: ctx.editor.isActive("heading", { level: 3 }),
        isBulletList: ctx.editor.isActive("bulletList"),
        isOrderedList: ctx.editor.isActive("orderedList"),
        isTaskList: ctx.editor.isActive("taskList"),
        isBlockquote: ctx.editor.isActive("blockquote"),
        isCodeBlock: ctx.editor.isActive("codeBlock"),
        isLink: ctx.editor.isActive("link"),
      };
    },
  });

  function openLinkModal() {
    if (!editor) return;
    const previousUrl = editor.getAttributes("link").href ?? "";
    setLinkDefault(previousUrl);
    setLinkModalOpen(true);
  }

  function handleLinkSubmit(url: string) {
    if (!editor) return;
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }

  function handleImageUrl(url: string) {
    if (!editor) return;
    editor.chain().focus().setImage({ src: url }).run();
  }

  async function handleImageFile(file: File) {
    if (!editor || !onImageUpload) return;
    const url = await onImageUpload(file);
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  }

  const isMobile = useIsMobile();

  const iconSize = isMobile ? 18 : 16;

  if (!editor || !editorState) {
    return (
      <>
        <div className={`flex items-center gap-0.5 px-2 py-1.5 md:px-3 md:py-1.5 bg-white dark:bg-stone-950 sticky top-0 z-10 overflow-x-auto md:flex-wrap border-b border-stone-200 dark:border-stone-800 toolbar-scroll opacity-50 pointer-events-none`}>
          <ToolbarButton onClick={() => {}} disabled title="Undo"><Undo size={iconSize} /></ToolbarButton>
          <ToolbarButton onClick={() => {}} disabled title="Redo"><Redo size={iconSize} /></ToolbarButton>
          <Separator />
          <ToolbarButton onClick={() => {}} disabled title="Heading 1"><Heading1 size={iconSize} /></ToolbarButton>
          <ToolbarButton onClick={() => {}} disabled title="Heading 2"><Heading2 size={iconSize} /></ToolbarButton>
          <ToolbarButton onClick={() => {}} disabled title="Heading 3"><Heading3 size={iconSize} /></ToolbarButton>
          <Separator />
          <ToolbarButton onClick={() => {}} disabled title="Bold"><Bold size={iconSize} /></ToolbarButton>
          <ToolbarButton onClick={() => {}} disabled title="Italic"><Italic size={iconSize} /></ToolbarButton>
          <ToolbarButton onClick={() => {}} disabled title="Underline"><Underline size={iconSize} /></ToolbarButton>
        </div>
      </>
    );
  }

  return (
    <>
      <div className={`flex items-center gap-0.5 px-2 py-1.5 md:px-3 md:py-1.5 bg-white dark:bg-stone-950 sticky top-0 z-10 overflow-x-auto md:flex-wrap border-b border-stone-200 dark:border-stone-800 toolbar-scroll${disabled ? " opacity-50 pointer-events-none" : ""}`}>
        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editorState.canUndo}
          title="Undo"
        >
          <Undo size={iconSize} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editorState.canRedo}
          title="Redo"
        >
          <Redo size={iconSize} />
        </ToolbarButton>

        <Separator />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          active={editorState.isH1}
          title="Heading 1"
        >
          <Heading1 size={iconSize} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editorState.isH2}
          title="Heading 2"
        >
          <Heading2 size={iconSize} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editorState.isH3}
          title="Heading 3"
        >
          <Heading3 size={iconSize} />
        </ToolbarButton>

        <Separator />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editorState.isBold}
          title="Bold"
        >
          <Bold size={iconSize} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editorState.isItalic}
          title="Italic"
        >
          <Italic size={iconSize} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          active={editorState.isUnderline}
          title="Underline"
        >
          <Underline size={iconSize} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          active={editorState.isStrike}
          title="Strikethrough"
        >
          <Strikethrough size={iconSize} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCode().run()}
          active={editorState.isCode}
          title="Inline code"
        >
          <Code size={iconSize} />
        </ToolbarButton>

        <Separator />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editorState.isBulletList}
          title="Bullet list"
        >
          <List size={iconSize} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editorState.isOrderedList}
          title="Ordered list"
        >
          <ListOrdered size={iconSize} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          active={editorState.isTaskList}
          title="Task list"
        >
          <ListTodo size={iconSize} />
        </ToolbarButton>

        <Separator />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editorState.isBlockquote}
          title="Blockquote"
        >
          <Quote size={iconSize} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          active={editorState.isCodeBlock}
          title="Code block"
        >
          <CodeSquare size={iconSize} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="Horizontal rule"
        >
          <Minus size={iconSize} />
        </ToolbarButton>

        <Separator />

        <ToolbarButton
          onClick={openLinkModal}
          active={editorState.isLink}
          title="Link"
        >
          <LinkIcon size={iconSize} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => setImageModalOpen(true)}
          title="Insert image"
        >
          <ImageIcon size={iconSize} />
        </ToolbarButton>

        {onSummarize && (
          <>
            <Separator />
            <ToolbarButton
              onClick={onSummarize}
              disabled={aiLoading}
              title="Summarize with AI"
            >
              <Sparkles size={iconSize} className={aiLoading ? "animate-pulse" : ""} />
            </ToolbarButton>
          </>
        )}
      </div>

      <PromptModal
        open={linkModalOpen}
        onClose={() => setLinkModalOpen(false)}
        onSubmit={handleLinkSubmit}
        title="Insert link"
        placeholder="https://example.com"
        defaultValue={linkDefault}
        submitLabel="Apply"
      />

      <ImageUploadModal
        open={imageModalOpen}
        onClose={() => setImageModalOpen(false)}
        onUpload={handleImageFile}
        onUrl={handleImageUrl}
      />
    </>
  );
}
