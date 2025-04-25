import { useState, useEffect, useRef } from "react";
import { X, Pencil } from "lucide-react";
import {
  keywordSearch,
  keywordTypeSearch,
  logToOutput,
  openFile,
  urlSearch,
  openBrowserPage,
} from "@/commandApi";
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
  url?: string;
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
  url,
}: ReferenceChipProps) {
  const [text, setText] = useState<string>(initialText);
  const [isEditing, setIsEditing] = useState<boolean>(autoEdit);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const getChunkDetail = (chunks: Chunk[]) => {
    let start_line: number = chunks[0].start_line;
    let end_line: number = chunks[0].end_line;
    for (let i = 1; i < chunks.length; i++) {
      if (chunks[i].start_line < start_line) {
        start_line = chunks[i].start_line;
      }
      if (chunks[i].end_line > end_line) {
        end_line = chunks[i].end_line;
      }
    }
    return `${start_line}-${end_line}`;
  };

  useEffect(() => {
    if (text.split(": ")[1] === "") {
      setIsEditing(true);
    }
  }, [text]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setText(initialText);
  }, [initialText]);

  useEffect(() => {
    if (autoEdit) {
      setIsEditing(true);
    }
  }, [autoEdit]);

  const handleEdit = () => {
    if (displayOnly) {
      return;
    }
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
          valueArr[0].toLowerCase(),
        )
      ) {
        setShowAutoComplete(true);
        keywordTypeSearch({
          type: valueArr[0].toLowerCase(),
          keyword: valueArr[1],
        });
      } else if (valueArr[0].toLowerCase() === "url") {
        setShowAutoComplete(true);
        urlSearch({
          keyword: valueArr[1].trim(),
        });
      } else {
        setShowAutoComplete(true);
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

  const handleBlur = () => {
    setIsEditing(false);
    setShowAutoComplete(false);
  };

  const handleDisplayClick = () => {
    if (displayOnly) {
      url ? openBrowserPage(url) : openFile(path ? path : "");
    }
  };

  return (
    <span
      onClick={handleDisplayClick}
      className={`inline-flex items-center ${
        displayOnly
          ? "cursor-pointer space-x-1.5 px-1.5 py-0 text-xs hover:bg-[var(--vscode-list-hoverBackground)]"
          : "cursor-pointer space-x-1.5 px-2 py-0.5 text-xs hover:bg-[var(--vscode-editor-hoverHighlightBackground)]" // Changed to smaller padding and text size
      } rounded-md border border-[var(--vscode-editorWidget-border)] bg-[var(--vscode-editor-background)] font-normal text-[var(--vscode-editor-foreground)] transition-colors ${
        !displayOnly && "mb-0.5 mr-0.5" // Reduced margins
      } shadow-sm`}
    >
      {isEditing && !displayOnly ? (
        <input
          type="text"
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          autoFocus
          className="w-auto rounded-sm border-none bg-transparent px-1 text-xs text-[var(--vscode-input-foreground)] placeholder-[var(--vscode-input-placeholderForeground)] caret-[var(--vscode-editor-foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--vscode-focusBorder)]" // Smaller text and reduced focus ring
        />
      ) : (
        <span onClick={handleEdit} className="group flex items-center gap-1">
          {chunks?.length ? `@${text}:${getChunkDetail(chunks)}` : "@" + text}
          {!displayOnly && (
            <Pencil
              size={12}
              className="text-[var(--vscode-icon-foreground)] opacity-0 transition-opacity group-hover:opacity-70"
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
          className="rounded-full p-0.5 text-[var(--vscode-icon-foreground)] transition-colors hover:bg-[var(--vscode-toolbar-hoverBackground)]"
        >
          <X size={14} className="hover:text-[var(--vscode-errorForeground)]" />
        </button>
      )}
    </span>
  );
}
