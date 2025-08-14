import { parse, Allow } from 'partial-json';
import { useThemeStore } from '@/stores/useThemeStore';
import { TerminalIcon } from 'lucide-react';

export function TerminalPanelHistory({
  tool_id,
  terminal_command,
  status,
}: {
  tool_id: string;
  terminal_command: string;
  status?: 'pending' | 'completed' | 'error' | 'aborted' | 'history';
}) {
  const { themeKind } = useThemeStore();
  const borderClass =
    themeKind === 'high-contrast' || themeKind === 'high-contrast-light'
      ? 'border border-[--deputydev-button-border]'
      : '';

  return (
    <div className={`mt-2 w-full rounded-md border border-gray-500/40 ${borderClass}`}>
      <div className="flex h-9 items-center border-b border-gray-500/40 px-2 text-sm">
        <TerminalIcon className="mr-2 h-3.5 w-3.5 rounded-sm border border-current" />
        <span className="text-sm">Terminal Command</span>
      </div>
      <div className="max-h-40 overflow-auto whitespace-pre-wrap border-b border-gray-500/40 bg-[--vscode-editor-background] font-mono text-sm text-[--vscode-terminal-foreground]">
        <div className="flex items-center px-2 pb-2 pt-2.5">
          <textarea
            className="no-scrollbar h-6 w-full resize-none overflow-x-auto overflow-y-hidden whitespace-nowrap bg-transparent font-mono text-sm text-[--vscode-terminal-foreground] focus:outline-none focus:ring-0"
            value={terminal_command}
            disabled
            readOnly
            spellCheck={false}
          />
        </div>
      </div>
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
    </div>
  );
}
