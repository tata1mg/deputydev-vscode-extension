import { openFile, openBrowserPage, revealFolderInExplorer } from '@/commandApi';
import { Chunk } from '@/types';
import { X, Folder, File, Boxes, Link, SquareFunction } from 'lucide-react';

/**
 * InputReferenceChip — clickable chip with delete button (no editing).
 */
type InputReferenceChipProps = {
  chipIndex: number;
  text: string;
  type: 'file' | 'directory' | 'function' | 'keyword' | 'code_snippet' | 'url' | 'class';
  value?: string;
  onDelete: () => void;
  path?: string;
  chunks?: Chunk[];
  url?: string;
};

export default function InputReferenceChip({
  chipIndex,
  text,
  type,
  value,
  onDelete,
  path,
  chunks,
  url,
}: InputReferenceChipProps) {
  const safeChunks = Array.isArray(chunks) ? chunks : [];

  const getChunkDetail = (chunks: Chunk[]) => {
    let start_line = chunks[0].start_line;
    let end_line = chunks[0].end_line;

    for (let i = 1; i < chunks.length; i++) {
      if (chunks[i].start_line < start_line) start_line = chunks[i].start_line;
      if (chunks[i].end_line > end_line) end_line = chunks[i].end_line;
    }
    return { start_line, end_line, display: `${start_line}-${end_line}` };
  };

  const chunkDetail = safeChunks.length ? getChunkDetail(safeChunks) : undefined;

  const handleClick = () => {
    if (type === 'url' && url) {
      openBrowserPage(url);
    } else if (type === 'directory' && path) {
      revealFolderInExplorer(path);
    } else if (path) {
      if (chunkDetail) {
        openFile(path, chunkDetail.start_line, chunkDetail.end_line);
      } else {
        openFile(path);
      }
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'class':
        return <Boxes size={12} className="flex-shrink-0 text-blue-400" />;
      case 'function':
        return <SquareFunction size={12} className="flex-shrink-0 text-purple-400" />;
      case 'file':
        return <File size={12} className="flex-shrink-0 text-green-400" />;
      case 'directory':
        return <Folder size={12} className="flex-shrink-0 text-blue-400" />;
      case 'url':
        return <Link size={12} className="flex-shrink-0 text-blue-400" />;
      default:
        return <File size={12} className="flex-shrink-0 text-gray-400" />;
    }
  };

  const displayText = chunkDetail ? `${value}:${chunkDetail.display}` : value;

  return (
    <span className="mb-0.5 mr-0.5 inline-flex max-w-full items-stretch overflow-hidden rounded-md border border-[var(--vscode-editorWidget-border)] bg-[var(--vscode-editor-background)] text-[0.7rem] font-normal text-[var(--vscode-editor-foreground)] shadow-sm">
      <span
        onClick={handleClick}
        className="flex min-w-0 cursor-pointer items-center space-x-1 px-1.5 py-0.5 transition-colors hover:bg-[var(--vscode-editor-hoverHighlightBackground)]"
      >
        {getIcon()}
        <span className="truncate" title={displayText}>
          {displayText}
        </span>
      </span>
      <button
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDelete();
        }}
        className="flex flex-shrink-0 items-center border-l border-[var(--vscode-editorWidget-border)] px-[0.3rem] text-[var(--vscode-icon-foreground)] transition-colors hover:bg-[var(--vscode-toolbar-hoverBackground)]"
        aria-label={`Delete reference chip #${chipIndex}`}
      >
        <X size={14} className="hover:text-[var(--vscode-errorForeground)]" />
      </button>
    </span>
  );
}
