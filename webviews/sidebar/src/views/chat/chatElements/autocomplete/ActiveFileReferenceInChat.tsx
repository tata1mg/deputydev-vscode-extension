import { File } from 'lucide-react';
import { openFile } from '@/commandApi';
import { ActiveFileChatReferenceItem } from '@/types';

type Props = {
  activeFileReference: ActiveFileChatReferenceItem;
};

export default function ActiveFileReferenceInChat({ activeFileReference }: Props) {
  const { activeFileUri, startLine, endLine } = activeFileReference;

  const filename = activeFileUri.split('/').pop() ?? activeFileUri;
  const lineInfo =
    startLine !== undefined
      ? endLine !== undefined
        ? `${startLine}-${endLine}`
        : `${startLine}`
      : '';
  const displayText = `${filename}${lineInfo ? `:${lineInfo}` : ''}`;

  const handleClick = () => {
    openFile(activeFileUri, startLine, endLine, true);
  };

  return (
    <span
      onClick={handleClick}
      className="inline-flex cursor-pointer items-center space-x-1.5 rounded-md border border-[var(--vscode-editorWidget-border)] bg-[var(--vscode-editor-background)] px-1.5 py-0 text-xs font-normal text-[var(--vscode-editor-foreground)] transition-colors hover:bg-[var(--vscode-list-hoverBackground)]"
    >
      <File size={12} className="text-[#61dafb]" />
      <span>{displayText}</span>
    </span>
  );
}
