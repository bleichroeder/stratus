"use client";

import type { Editor } from "@tiptap/react";
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
} from "lucide-react";
import { useState } from "react";
import { PromptModal, ImageUploadModal } from "@/components/ui/modal";

interface EditorToolbarProps {
  editor: Editor | null;
  onImageUpload?: (file: File) => Promise<string | null>;
  disabled?: boolean;
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
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-1.5 rounded hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors ${
        active ? "bg-stone-200 dark:bg-stone-700 text-stone-900 dark:text-stone-100" : "text-stone-600 dark:text-stone-400"
      } ${disabled ? "opacity-30 cursor-not-allowed" : ""}`}
    >
      {children}
    </button>
  );
}

function Separator() {
  return <div className="w-px h-5 bg-stone-300 dark:bg-stone-600 mx-1" />;
}

export function EditorToolbar({ editor, onImageUpload, disabled = false }: EditorToolbarProps) {
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkDefault, setLinkDefault] = useState("");
  const [imageModalOpen, setImageModalOpen] = useState(false);

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

  if (!editor) return null;

  const iconSize = 16;

  return (
    <>
      <div className={`flex items-center gap-0.5 px-2 py-1 md:px-3 md:py-1.5 bg-white dark:bg-stone-950 sticky top-0 z-10 flex-wrap${disabled ? " opacity-50 pointer-events-none" : ""}`}>
        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title="Undo"
        >
          <Undo size={iconSize} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title="Redo"
        >
          <Redo size={iconSize} />
        </ToolbarButton>

        <Separator />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          active={editor.isActive("heading", { level: 1 })}
          title="Heading 1"
        >
          <Heading1 size={iconSize} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive("heading", { level: 2 })}
          title="Heading 2"
        >
          <Heading2 size={iconSize} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor.isActive("heading", { level: 3 })}
          title="Heading 3"
        >
          <Heading3 size={iconSize} />
        </ToolbarButton>

        <Separator />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive("bold")}
          title="Bold"
        >
          <Bold size={iconSize} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive("italic")}
          title="Italic"
        >
          <Italic size={iconSize} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          active={editor.isActive("underline")}
          title="Underline"
        >
          <Underline size={iconSize} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          active={editor.isActive("strike")}
          title="Strikethrough"
        >
          <Strikethrough size={iconSize} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCode().run()}
          active={editor.isActive("code")}
          title="Inline code"
        >
          <Code size={iconSize} />
        </ToolbarButton>

        <Separator />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive("bulletList")}
          title="Bullet list"
        >
          <List size={iconSize} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive("orderedList")}
          title="Ordered list"
        >
          <ListOrdered size={iconSize} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          active={editor.isActive("taskList")}
          title="Task list"
        >
          <ListTodo size={iconSize} />
        </ToolbarButton>

        <Separator />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive("blockquote")}
          title="Blockquote"
        >
          <Quote size={iconSize} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          active={editor.isActive("codeBlock")}
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
          active={editor.isActive("link")}
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
