import { acceptTerminalCommand, editTerminalCommand, logToOutput } from '@/commandApi';
import { useState, useEffect } from 'react';
import { parse, Allow } from 'partial-json';
import { TerminalPanelProps } from '@/types';
import { useThemeStore } from '@/stores/useThemeStore';
import { TerminalIcon, LoaderCircle } from 'lucide-react';
import { useChatStore } from '@/stores/chatStore';
import { cn } from '@/lib/utils';

/**
 * Updates the terminal approval status for a specific tool use request in the chat history.
 * NOTE: This directly modifies the Zustand store state. Consider moving this logic
 * into a dedicated store action if complexity grows.
 * @param tool_use_id The ID of the tool use request.
 * @param required The new approval status (true if required, false otherwise).
 */
function updateTerminalApproval(tool_use_id: string, required: boolean) {
  const history = useChatStore.getState().history;

  const updatedHistory = history.map((msg) => {
    if (msg.type === 'TOOL_USE_REQUEST' && msg.content.tool_use_id === tool_use_id) {
      // Ensure terminal_approval_required exists before updating
      if (msg.content.terminal_approval_required !== undefined) {
        return {
          ...msg,
          content: {
            ...msg.content,
            terminal_approval_required: required,
          },
        };
      }
    }
    return msg;
  });

  // Only update state if changes were actually made (or potentially made)
  // A more robust check might compare old and new history arrays if performance is critical.
  useChatStore.setState({ history: updatedHistory });
}

export function TerminalPanel({
  tool_id,
  terminal_command,
  status,
  show_approval_options,
}: TerminalPanelProps) {
  const [isStreaming, setIsStreaming] = useState(true);
  const [editInput, setEditInput] = useState('');
  const [commandState, setCommandState] = useState('');
  const [isEditPromptOpen, setIsEditPromptOpen] = useState(false);
  const [isEditingApiCall, setIsEditingApiCall] = useState(false);
  const [dots, setDots] = useState('');
  const { themeKind } = useThemeStore();
  const borderClass =
    themeKind === 'high-contrast' || themeKind === 'high-contrast-light'
      ? 'border border-[--deputydev-button-border]'
      : '';

  // Parse and set commandState from terminal_command prop
  useEffect(() => {
    try {
      const parsed = parse(terminal_command, Allow.STR | Allow.OBJ);
      if (parsed && typeof parsed === 'object') {
        setCommandState(parsed.command || '');
        setIsStreaming(false);
      }
    } catch {
      // still streaming, clear command
      setCommandState('');
    }
  }, [terminal_command]);

  // useEffect(() => {
  //   if (status === "aborted") {
  //     updateTerminalApproval(tool_id, false);
  //   }
  // }, [status, tool_id]);

  useEffect(() => {
    if (!(isEditingApiCall || (isStreaming && !commandState))) {
      setDots('');
      return;
    }

    const timer = setInterval(() => {
      setDots((prev) => (prev.length < 3 ? prev + '.' : ''));
    }, 500);

    return () => clearInterval(timer);
  }, [isEditingApiCall, isStreaming, commandState]);

  // Handler to accept and execute the current command
  const handleExecute = () => {
    if (!commandState) return;
    acceptTerminalCommand(tool_id, commandState);
    updateTerminalApproval(tool_id, false);
  };

  // Handler to open the inline edit prompt
  const handleEditPromptOpen = () => {
    setIsEditPromptOpen(true);
    setEditInput(''); // Clear previous edit input
  };

  // Handler to close the inline edit prompt
  const handleEditPromptCancel = () => {
    setIsEditPromptOpen(false);
  };

  // Handler to submit the edit request
  const handleEditSubmit = async () => {
    const userQuery = editInput.trim();
    if (!userQuery) return;

    setIsEditingApiCall(true); // Indicate API call started
    setIsEditPromptOpen(false); // Close the prompt

    try {
      const currentCommand = commandState?.trim() || '<no command exists>';
      const newCommand = await editTerminalCommand({
        user_query: userQuery,
        old_command: currentCommand,
      });

      if (newCommand !== null && newCommand !== undefined) {
        // Check if editTerminalCommand returned a valid command
        setCommandState(newCommand); // Update the displayed command
      } else {
        logToOutput('info', 'Edit command did not return a new command.');
      }
    } catch (err) {
      logToOutput(
        'error',
        `Failed to edit command: ${err instanceof Error ? err.message : String(err)}`
      );
      // Optionally: Re-open edit prompt or show error message to user
    } finally {
      setIsEditingApiCall(false); // Indicate API call finished
      setEditInput(''); // Clear the input field after submission attempt
    }
  };

  // Determine button disabled states
  const isExecuteDisabled = commandState === null || commandState.trim() === '' || isEditingApiCall;

  return (
    <div className="mt-2 w-full rounded-md border border-gray-500/40">
      <div className="flex h-9 items-center justify-between border-b border-gray-500/40 px-2 text-sm">
        <div className="flex items-center space-x-2">
          <TerminalIcon className="h-3.5 w-3.5 rounded-sm border border-current" />
          <span className="text-sm">Terminal Command</span>
        </div>
      </div>

      <div className="max-h-40 overflow-auto whitespace-pre-wrap border-b border-gray-500/40 bg-[--vscode-editor-background] font-mono text-sm text-[--vscode-terminal-foreground]">
        {(() => {
          switch (true) {
            case isEditingApiCall:
              return (
                <div className="flex items-center gap-2 px-2 py-3">
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  {`Editing${dots}`}
                </div>
              );

            case isStreaming && !commandState:
              return (
                <div className="flex items-center gap-2 px-2 py-3">
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  {`Streaming command${dots}`}
                </div>
              );

            default:
              return (
                <div className="flex items-center px-2 pb-2 pt-2.5">
                  <textarea
                    className="no-scrollbar h-6 w-full resize-none overflow-x-auto overflow-y-hidden whitespace-nowrap bg-transparent font-mono text-sm text-[--vscode-terminal-foreground] focus:outline-none focus:ring-0"
                    value={commandState}
                    disabled={status === 'completed' || status === 'aborted'}
                    onChange={(e) => setCommandState(e.target.value)}
                    placeholder="Enter terminal command..."
                    spellCheck={false}
                  />
                </div>
              );
          }
        })()}
      </div>

      {/* only show these when not editing */}
      {show_approval_options && !isEditPromptOpen && (
        <>
          <div className="px-2 py-2 text-xs italic text-[--vscode-editorWarning-foreground]">
            This command requires your approval before it can be executed.
          </div>
          <div className="flex space-x-2 px-2 pb-2">
            <button
              onClick={handleExecute}
              disabled={isExecuteDisabled}
              className={`flex-1 rounded bg-[--deputydev-button-background] px-2 py-2 font-semibold text-[--deputydev-button-foreground] hover:bg-[--deputydev-button-hover-background] ${borderClass} disabled:cursor-progress disabled:opacity-80`}
            >
              Execute
            </button>
            <button
              onClick={handleEditPromptOpen}
              disabled={isEditingApiCall}
              className={`flex-1 rounded bg-[--deputydev-button-secondaryBackground] px-2 py-2 font-semibold text-[--deputydev-button-secondaryForeground] hover:bg-[--deputydev-button-secondaryHoverBackground] ${borderClass} disabled:cursor-progress disabled:opacity-80`}
            >
              Edit
            </button>
          </div>
        </>
      )}

      {show_approval_options === false && (
        <div className="flex items-center gap-2 px-2 py-2 text-xs">
          <strong>Status:</strong>
          {status === 'pending' ? (
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
      {isEditPromptOpen && (
        <div className="px-2 py-2">
          <textarea
            className="w-full rounded border border-gray-500/40 bg-transparent p-2 text-sm focus:outline-none focus:ring-0"
            value={editInput}
            onChange={(e) => setEditInput(e.target.value)}
            placeholder="Update this command using DeputyDev…"
          />
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              onClick={handleEditPromptCancel}
              className={`rounded bg-[--deputydev-button-secondaryBackground] px-3 py-1 text-xs font-medium text-[--deputydev-button-secondaryForeground] hover:bg-[--deputydev-button-secondaryHoverBackground] ${borderClass}`}
            >
              Cancel
            </button>
            <button
              onClick={handleEditSubmit}
              disabled={isEditingApiCall || !editInput.trim()}
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
