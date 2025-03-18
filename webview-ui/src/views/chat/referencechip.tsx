import { useState, useEffect, useRef } from "react";
import { X, Pencil } from "lucide-react";
import { keywordSearch, keywordTypeSearch, openFile } from "@/commandApi";
import { useChatStore, initialAutocompleteOptions } from "@/stores/chatStore";

type ReferenceChipProps = {
  chipIndex: number;
  initialText: string;
  onDelete: () => void;
  autoEdit?: boolean;
  setShowAutoComplete: (value: boolean) => void;
  displayOnly?: boolean;
  path?: string;
};

export default function ReferenceChip({
  chipIndex,
  initialText,
  onDelete,
  autoEdit = false,
  setShowAutoComplete,
  displayOnly = false,
  path,
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
    if (value === "") {
      useChatStore.setState({
        ChatAutocompleteOptions: initialAutocompleteOptions,
      });
      return;
    }

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
        keywordTypeSearch({
          type: valueArr[0].toLowerCase(),
          keyword: valueArr[1],
        });
      } else {
        keywordSearch({ keyword: value });
      }
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && text === "") {
      e.preventDefault();
      onDelete();
    }
  };

  const handleBlur = () => setIsEditing(false);

  const handleDisplayClick = () => {
    if (displayOnly) {
      openFile("webview-ui/src/views/chat/chat.tsx");
    }
  };

  return (
    <span
      onClick={handleDisplayClick}
      className={`inline-flex items-center gap-1.5 ${
        displayOnly
          ? "px-1.5 py-0 text-xs cursor-pointer hover:bg-[var(--vscode-list-hoverBackground)] space-x-1.5 space-y-0.5"
          : "px-3 py-1 text-sm cursor-pointer hover:bg-[var(--vscode-editor-hoverHighlightBackground)] space-x-2 space-y-1"
      } bg-[var(--vscode-editor-background)] border border-[var(--vscode-editorWidget-border)] text-[var(--vscode-editor-foreground)] rounded-md font-normal transition-colors ${
        !displayOnly && "mr-1 mb-1"
      } shadow-sm`} // ← Changed margin condition
    >
      {isEditing && !displayOnly ? (
        <input
          type="text"
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          autoFocus
          className="bg-transparent border-none focus:outline-none w-auto px-1 text-[var(--vscode-input-foreground)] caret-[var(--vscode-editor-foreground)] placeholder-[var(--vscode-input-placeholderForeground)] focus:ring-2 focus:ring-[var(--vscode-focusBorder)] rounded-sm"
        />
      ) : (
        <span onClick={handleEdit} className="flex items-center gap-1.5 group">
          {text}
          {!displayOnly && (
            <Pencil
              size={14}
              className="text-[var(--vscode-icon-foreground)] opacity-0 group-hover:opacity-70 transition-opacity"
            />
          )}
        </span>
      )}
      {!displayOnly && (
        <button
          onClick={onDelete}
          className="text-[var(--vscode-icon-foreground)] hover:bg-[var(--vscode-toolbar-hoverBackground)] rounded-full p-0.5 transition-colors"
        >
          <X size={16} className="hover:text-[var(--vscode-errorForeground)]" />
        </button>
      )}
    </span>
  );
}
