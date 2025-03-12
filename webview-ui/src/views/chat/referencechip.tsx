import { useState, useEffect, useRef } from "react";
import { X, Pencil } from "lucide-react";
import { keywordSearch, keywordTypeSearch, logToOutput } from "@/commandApi";
import { useChatStore } from "@/stores/chatStore";

type ReferenceChipProps = {
  chipIndex: number;
  initialText: string;
  onDelete: () => void;
  autoEdit?: boolean;
  setShowAutoComplete: (value: boolean) => void;
};

export default function ReferenceChip({
  chipIndex,
  initialText,
  onDelete,
  autoEdit = false,
  setShowAutoComplete
}: ReferenceChipProps) {
  const [text, setText] = useState<string>(initialText);
  const [isEditing, setIsEditing] = useState<boolean>(autoEdit);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setText(initialText);
    setIsEditing(true);
  }, [initialText]);

  useEffect(() => {
    if (autoEdit) {
      setIsEditing(true);
      useChatStore.setState({ chipIndexBeingEdited: chipIndex });
    }
  }, [autoEdit]);

  const handleEdit = () => {
    useChatStore.setState({ chipIndexBeingEdited: chipIndex });
    setIsEditing(true);
    setShowAutoComplete(true);
  };
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setText(value);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      const valueArr = value.split(": ");
      if (
        ["file", "directory", "function", "class"].includes(
          valueArr[0].toLowerCase()
        )
      ) {
        keywordTypeSearch({ type: valueArr[0].toLowerCase(), keyword: valueArr[1] });
      } else {
        keywordSearch({ keyword: value });
      }
    }, 500);
  };
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
