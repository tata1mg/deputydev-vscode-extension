import { useState, useEffect, useRef } from "react";
import { X, Pencil } from "lucide-react";
import { keywordSearch, keywordTypeSearch, openFile } from "@/commandApi";
import { useChatStore, initialAutocompleteOptions } from "@/stores/chatStore";
import { Chunk } from "@/types";

type ReferenceChipProps = {
  chipIndex: number;
  initialText: string;
  onDelete: () => void;
  autoEdit?: boolean;
  setShowAutoComplete: (value: boolean) => void;
  displayOnly?: boolean;
  path?: string;
  chunks?: Chunk[];
  noEdit?: boolean;
};

export default function ReferenceChip({
  chipIndex,
  initialText,
  onDelete,
  autoEdit = false,
  setShowAutoComplete,
  displayOnly = false,
  path,
  chunks = [] as Chunk[],
  noEdit = false,
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
      openFile(path ? path : "");
    }
  };

  return (
    <span
      onClick={handleDisplayClick}
      className={`inline-flex items-center ${
        displayOnly
          ? "px-1.5 py-0 text-xs cursor-pointer hover:bg-[var(--vscode-list-hoverBackground)] space-x-1.5"
          : "px-2 py-0.5 text-xs cursor-pointer hover:bg-[var(--vscode-editor-hoverHighlightBackground)] space-x-1.5" // Changed to smaller padding and text size
      } bg-[var(--vscode-editor-background)] border border-[var(--vscode-editorWidget-border)] text-[var(--vscode-editor-foreground)] rounded-md font-normal transition-colors ${
        !displayOnly && "mr-0.5 mb-0.5" // Reduced margins
      } shadow-sm`}
    >
      {isEditing && !displayOnly && !noEdit ? (
        <input
          type="text"
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          autoFocus={!noEdit}
          className="bg-transparent border-none focus:outline-none w-auto px-1 text-xs text-[var(--vscode-input-foreground)] caret-[var(--vscode-editor-foreground)] placeholder-[var(--vscode-input-placeholderForeground)] focus:ring-1 focus:ring-[var(--vscode-focusBorder)] rounded-sm" // Smaller text and reduced focus ring
        />
      ) : (
        <span onClick={handleEdit} className="flex items-center gap-1 group">
          {chunks.length
            ? `@${text}:${chunks[0].start_line}-${chunks[0].end_line}`
            : "@" + text}
          {!displayOnly && (
            <Pencil
              size={12}
              className="text-[var(--vscode-icon-foreground)] opacity-0 group-hover:opacity-70 transition-opacity"
            />
          )}
        </span>
      )}
      {!displayOnly && (
        <button
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDelete();
          }}
          className="text-[var(--vscode-icon-foreground)] hover:bg-[var(--vscode-toolbar-hoverBackground)] rounded-full p-0.5 transition-colors"
        >
          <X size={14} className="hover:text-[var(--vscode-errorForeground)]" />
        </button>
      )}
    </span>
  );
}
