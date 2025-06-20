import { openFile, openBrowserPage, revealFolderInExplorer } from '@/commandApi';
import { ChatReferenceItemTypes, Chunk } from '@/types';
import { Boxes, Folder, File, Link, SquareFunction } from 'lucide-react';

/**
 * QueryReferenceChip — chip component used only for navigation (clickable, not editable or deletable).
 */
type QueryReferenceChipProps = {
  value?: string;
  type: ChatReferenceItemTypes;
  path?: string;
  chunks?: Chunk[];
  url?: string;
};

export default function QueryReferenceChip({
  value,
  type,
  path,
  chunks = [],
  url,
}: QueryReferenceChipProps) {
  const safeChunks = Array.isArray(chunks) ? chunks : [];

  const getChunkDetail = (chunks: Chunk[]) => {
    let startLine = chunks[0].start_line;
    let endLine = chunks[0].end_line;

    for (let i = 1; i < chunks.length; i++) {
      if (chunks[i].start_line < startLine) startLine = chunks[i].start_line;
      if (chunks[i].end_line > endLine) endLine = chunks[i].end_line;
    }
    return { startLine, endLine, display: `${startLine}-${endLine}` };
  };

  const chunkDetail = safeChunks.length ? getChunkDetail(safeChunks) : undefined;

  const handleClick = () => {
    if (type === 'url' && url) {
      openBrowserPage(url);
    } else if (type === 'directory' && path) {
      revealFolderInExplorer(path);
    } else if (path) {
      if (chunkDetail) {
        openFile(path, chunkDetail.startLine, chunkDetail.endLine);
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
  const displayText = value ? (chunkDetail ? `${value}:${chunkDetail.display}` : value) : '';
  return (
    <span
      onClick={handleClick}
      className="inline-flex cursor-pointer items-center space-x-1.5 rounded-md border border-[var(--vscode-editorWidget-border)] bg-[var(--vscode-editor-background)] px-1.5 py-0 text-[0.7rem] font-normal text-[var(--vscode-editor-foreground)] transition-colors hover:bg-[var(--vscode-list-hoverBackground)]"
    >
      {getIcon()}
      <span className="truncate" title={displayText}>
        {displayText}
      </span>
    </span>
  );
}
