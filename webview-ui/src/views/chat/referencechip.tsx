import { useState } from "react";
import { X, Pencil } from "lucide-react";

type ReferenceChipProps = {
  initialText: string;
  onDelete: () => void;
};

export default function ReferenceChip({
  initialText,
  onDelete,
}: ReferenceChipProps) {
  const [text, setText] = useState<string>(initialText);
  const [isEditing, setIsEditing] = useState<boolean>(false);

  const handleEdit = () => setIsEditing(true);
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setText(e.target.value);
  const handleBlur = () => setIsEditing(false);

  return (
    <div className="inline-flex items-center gap-2 px-3 py-1 bg-[var(--vscode-editor-background)] border border-[var(--vscode-editorWidget-border)] text-[var(--vscode-editor-foreground)] rounded-md text-sm font-normal cursor-pointer hover:bg-[var(--vscode-editor-hoverHighlightBackground)] transition-colors mr-2 mb-2 shadow-sm">
      {isEditing ? (
        <input
          type="text"
          value={text}
          onChange={handleChange}
          onBlur={handleBlur}
          autoFocus
          className="bg-transparent border-none focus:outline-none w-auto px-1 text-[var(--vscode-input-foreground)] caret-[var(--vscode-editor-foreground)] placeholder-[var(--vscode-input-placeholderForeground)] focus:ring-2 focus:ring-[var(--vscode-focusBorder)] rounded-sm"
        />
      ) : (
        <span onClick={handleEdit} className="flex items-center gap-1.5 group">
          {text}
          <Pencil
            size={14}
            className="text-[var(--vscode-icon-foreground)] opacity-0 group-hover:opacity-70 transition-opacity"
          />
        </span>
      )}
      <button
        onClick={onDelete}
        className="text-[var(--vscode-icon-foreground)] hover:bg-[var(--vscode-toolbar-hoverBackground)] rounded-full p-0.5 transition-colors"
      >
        <X size={16} className="hover:text-[var(--vscode-errorForeground)]" />
      </button>
    </div>
  );
}
