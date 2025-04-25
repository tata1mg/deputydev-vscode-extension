import {
  acceptTerminalCommand,
  editTerminalCommand,
} from "@/commandApi";
import { useState, useEffect } from "react";
import { parse, Allow } from "partial-json";
import { TerminalPanelProps } from "@/types";
import { useThemeStore } from "@/stores/useThemeStore";
import { TerminalIcon, LoaderCircle } from "lucide-react";
import { useChatStore } from "@/stores/chatStore";

function updateTerminalApproval(tool_use_id: string , status: boolean) {
  const { history } = useChatStore();

  const updatedHistory = history.map((msg) => {
      if (msg.type === "TOOL_USE_REQUEST" && msg.content.tool_use_id === tool_use_id) {
        return {
          ...msg,
          content: {
            ...msg.content,
            terminal_approval_required: status,
          },
        };
      }
      return msg;
    });
    useChatStore.setState({ history: updatedHistory});

}

export function TerminalPanel({
  tool_id,
  terminal_command,
  status,
  show_approval_options,
}: TerminalPanelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editInput, setEditInput] = useState("");
  const [editDots, setEditDots] = useState("");
  const [streamDots, setStreamDots] = useState("");
  const [commandState, setCommandState] = useState(""); // store editable command
  const { themeKind } = useThemeStore();
  const borderClass =
    themeKind === "high-contrast" || themeKind === "high-contrast-light"
      ? "border border-[--deputydev-button-border]"
      : "";

  // Parse and set commandState from terminal_command prop
  useEffect(() => {
    try {
      const parsed = parse(terminal_command, Allow.STR | Allow.OBJ);
      if (parsed && typeof parsed === "object") {
        setCommandState(parsed.command || "");
      }
    } catch {
      // still streaming, clear command
      setCommandState("");
    }
  }, [terminal_command]);

  // animate dots in edit mode
  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (isEditing) {
      timer = setInterval(() => {
        setEditDots((prev) => (prev.length < 3 ? prev + "." : ""));
      }, 500);
    }
    return () => clearInterval(timer);
  }, [isEditing]);

  // animate dots while streaming command
  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (!commandState) {
      timer = setInterval(() => {
        setStreamDots((prev) => (prev.length < 3 ? prev + "." : ""));
      }, 500);
    }
    return () => clearInterval(timer);
  }, [commandState]);

  const handleExecute = () => {
    acceptTerminalCommand(tool_id);
    updateTerminalApproval(tool_id, false);
  };

  const handleEditOpen = () => {
    setEditOpen(true);
  };

  const handleEdit = async () => {
    if (!editInput.trim()) return;
    setIsEditing(true);
    const user_query = editInput.trim();
    setEditInput(""); // optional, you may skip this if you want to preserve the edit

    try {
      // Send the new command text to editTerminalCommand
      const newCommand = await editTerminalCommand({ user_query, old_command : commandState });
      setEditOpen(false);
      if (!newCommand) {
        return;
      }
      setCommandState(newCommand); // Display the new command
    } catch (err) {
      console.error("LLM edit error:", err);
    } finally {
      setIsEditing(false);
      
    }
  };

  return (
    <div className="mt-4 w-full rounded-md border border-gray-500/40">
      <div className="flex h-9 items-center justify-between border-b border-gray-500/40 px-2 text-sm">
        <div className="flex items-center space-x-2">
          <TerminalIcon className="h-3.5 w-3.5 rounded-sm border border-current" />
          <span className="text-sm">Terminal Command</span>
        </div>
      </div>

      <div className="max-h-40 overflow-auto whitespace-pre-wrap break-words border-b border-gray-500/40 bg-[--vscode-editor-background] px-2 py-3 font-mono text-sm text-[--vscode-terminal-foreground]">
        <pre className="flex items-center gap-2">
          {isEditing ? (
            <>
              <LoaderCircle className="h-4 w-4 animate-spin" />
              {`Editing${editDots}`}
            </>
          ) : commandState ? (
            commandState
          ) : (
            <>
              <LoaderCircle className="h-4 w-4 animate-spin" />
              {`Streaming command${streamDots}`}
            </>
          )}
        </pre>
      </div>

      {/* only show these when not editing */}
      {show_approval_options && !editOpen && (
        <>
          <div className="px-2 py-2 text-xs italic text-[--vscode-editorWarning-foreground]">
            This command requires your approval before it can be executed.
          </div>
          <div className="flex space-x-2 px-2 pb-2">
            <button
              onClick={handleExecute}
              // disabled={!commandState || isEditing}
              className={`flex-1 rounded bg-[--deputydev-button-background] px-2 py-2 font-semibold text-[--deputydev-button-foreground] hover:bg-[--deputydev-button-hover-background] ${borderClass} disabled:opacity-80`}
            >
              Execute
            </button>
            <button
              onClick={handleEditOpen}
              className={`flex-1 rounded bg-[--deputydev-button-secondaryBackground] px-2 py-2 font-semibold text-[--deputydev-button-secondaryForeground] hover:bg-[--deputydev-button-secondaryHoverBackground] ${borderClass}`}
            >
              Edit
            </button>
          </div>
        </>
      )}

      {(show_approval_options === false) && (
        <div className="flex items-center gap-2 px-2 py-2 text-xs">
          <strong>Status:</strong>
          {status === "pending" ? (
            <div className="flex items-center gap-2">
              <span>In progress</span>
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500"></span>
              </span>
            </div>
          ) : (
            <span className="capitalize">{status}</span>
          )}
        </div>
      )}

      {/* inline editor */}
      {editOpen && (
        <div className="px-2 py-2">
          <textarea
            className="w-full rounded border border-gray-500/40 bg-transparent p-2 text-sm"
            value={editInput}
            onChange={(e) => setEditInput(e.target.value)}
            placeholder="Update this command…"
          />
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              onClick={() => setEditOpen(false)}
              className={`rounded bg-[--deputydev-button-secondaryBackground] px-3 py-1 text-xs font-medium text-[--deputydev-button-secondaryForeground] hover:bg-[--deputydev-button-secondaryHoverBackground] ${borderClass}`}
            >
              Cancel
            </button>
            <button
              onClick={handleEdit}
              disabled={isEditing || !editInput.trim()}
              className={`rounded bg-[--deputydev-button-background] px-3 py-1 text-xs font-medium text-[--deputydev-button-foreground] hover:bg-[--deputydev-button-hover-background] ${borderClass} disabled:opacity-50`}
            >
              Edit
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
