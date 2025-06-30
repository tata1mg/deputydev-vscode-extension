import { useActiveFileStore } from '@/stores/activeFileStore';
import { Eye, EyeOff, File } from 'lucide-react';
import clsx from 'clsx';

export default function ActiveFileReferenceChip() {
  const activeFileUri = useActiveFileStore((state) => state.activeFileUri);
  const startLine = useActiveFileStore((state) => state.startLine);
  const endLine = useActiveFileStore((state) => state.endLine);
  const disableActiveFile = useActiveFileStore((state) => state.disableActiveFile);
  const toggleDisableActiveFile = useActiveFileStore((state) => state.toggleDisableActiveFile);

  if (!activeFileUri) return null;

  const filename = activeFileUri.split('/').pop() ?? activeFileUri;
  const lineInfo =
    startLine !== undefined
      ? endLine !== undefined
        ? `${startLine}-${endLine}`
        : `${startLine}`
      : '';
  const displayText = `${filename}${lineInfo ? `:${lineInfo}` : ''} Current file`;

  return (
    <span
      className={clsx(
        'mb-0.5 mr-0.5 inline-flex max-w-full items-stretch overflow-hidden',
        'rounded-md border border-dashed border-[var(--vscode-editorWidget-border)]',
        'bg-[var(--vscode-editor-background)] text-[0.7rem] font-normal',
        'text-[var(--vscode-editor-foreground)] shadow-sm',
        disableActiveFile && 'opacity-60'
      )}
    >
      <span
        className={clsx(
          'flex min-w-0 cursor-pointer items-center space-x-1 px-1.5 py-0.5 transition-colors',
          'hover:bg-[var(--vscode-editor-hoverHighlightBackground)]',
          disableActiveFile && 'italic'
        )}
        title={displayText}
      >
        <File size={12} className="flex-shrink-0 text-[#61dafb]" />
        <span className="truncate">{displayText}</span>
      </span>
      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          toggleDisableActiveFile();
        }}
        className="flex flex-shrink-0 items-center border-l border-dashed border-[var(--vscode-editorWidget-border)] px-[0.3rem] text-[var(--vscode-icon-foreground)] transition-colors hover:bg-[var(--vscode-toolbar-hoverBackground)]"
        aria-label={
          disableActiveFile ? 'Show active file reference chip' : 'Hide active file reference chip'
        }
      >
        {disableActiveFile ? (
          <EyeOff size={14} className="hover:text-[var(--vscode-errorForeground)]" />
        ) : (
          <Eye size={14} className="hover:text-[var(--vscode-errorForeground)]" />
        )}
      </button>
    </span>
  );
}
