"use client";

import { Modal } from "@/components/ui/modal";
import { extractTemplatePreview, type TemplateItem } from "@/lib/templates";
import {
  LayoutTemplate,
  ClipboardList,
  Users,
  Calendar,
  Bug,
  ListTodo,
  Settings,
} from "lucide-react";

interface TemplatePickerModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (template: TemplateItem) => void;
  templates: TemplateItem[];
  onManage?: () => void;
  mode: "create" | "insert";
}

const BUILTIN_ICONS: Record<string, React.ReactNode> = {
  "builtin-daily-standup": <ClipboardList size={20} />,
  "builtin-meeting-notes": <Users size={20} />,
  "builtin-weekly-review": <Calendar size={20} />,
  "builtin-bug-report": <Bug size={20} />,
  "builtin-todo-list": <ListTodo size={20} />,
};

export function TemplatePickerModal({
  open,
  onClose,
  onSelect,
  templates,
  onManage,
  mode,
}: TemplatePickerModalProps) {
  const builtIn = templates.filter((t) => t.builtIn);
  const custom = templates.filter((t) => !t.builtIn);

  function handleSelect(template: TemplateItem) {
    onSelect(template);
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === "create" ? "New from template" : "Insert template"}
    >
      <div className="space-y-3 max-h-[400px] overflow-y-auto -mx-4 px-4">
        {builtIn.length > 0 && (
          <div className="space-y-1">
            {builtIn.map((t) => (
              <TemplateCard
                key={t.id}
                template={t}
                icon={BUILTIN_ICONS[t.id] ?? <LayoutTemplate size={20} />}
                onClick={() => handleSelect(t)}
              />
            ))}
          </div>
        )}

        {custom.length > 0 && (
          <>
            <div className="flex items-center gap-2 pt-1">
              <span className="text-xs font-medium text-stone-400 dark:text-stone-500 uppercase tracking-wider">
                My Templates
              </span>
              <div className="flex-1 h-px bg-stone-200 dark:bg-stone-700" />
            </div>
            <div className="space-y-1">
              {custom.map((t) => (
                <TemplateCard
                  key={t.id}
                  template={t}
                  icon={<LayoutTemplate size={20} />}
                  onClick={() => handleSelect(t)}
                />
              ))}
            </div>
          </>
        )}

        {templates.length === 0 && (
          <p className="text-sm text-stone-400 dark:text-stone-500 text-center py-6">
            No templates available
          </p>
        )}
      </div>

      {onManage && (
        <div className="pt-3 mt-3 border-t border-stone-200 dark:border-stone-700">
          <button
            onClick={() => {
              onClose();
              onManage();
            }}
            className="flex items-center gap-1.5 text-xs text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 transition-colors"
          >
            <Settings size={12} />
            Manage templates
          </button>
        </div>
      )}
    </Modal>
  );
}

function TemplateCard({
  template,
  icon,
  onClick,
}: {
  template: TemplateItem;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  const preview = extractTemplatePreview(template.content);

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 w-full px-3 py-2.5 rounded-md text-left transition-colors hover:bg-stone-100 dark:hover:bg-stone-800"
    >
      <span className="shrink-0 text-stone-400 dark:text-stone-500 p-1.5 rounded-md bg-stone-100 dark:bg-stone-800">
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-sm font-medium text-stone-900 dark:text-stone-100">
          {template.title}
        </div>
        {preview && (
          <div className="text-xs text-stone-400 dark:text-stone-500 truncate">
            {preview}
          </div>
        )}
      </div>
    </button>
  );
}
