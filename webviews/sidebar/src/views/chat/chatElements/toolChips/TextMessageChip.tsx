import ActiveFileReferenceInChat from '../autocomplete/ActiveFileReferenceInChat';
import QueryReferenceChip from '../autocomplete/referencechip';
import { useThemeStore } from '@/stores/useThemeStore';
import { ChatAssistantMessage, ChatReferenceItem, ChatUserMessage, S3Object } from '@/types';
import { CircleUserRound } from 'lucide-react';
import { ImageWithDownload } from '../imageView';
import Markdown from 'react-markdown';

const TextMessageChip: React.FC<{ msg: ChatUserMessage | ChatAssistantMessage }> = ({ msg }) => {
  const { themeKind } = useThemeStore();

  switch (msg.actor) {
    case 'USER': {
      if (msg.focusItems && msg.focusItems.length > 0) {
        for (let i = 0; i < msg.focusItems.length; i++) {
          msg.focusItems[i].index = i;
          msg.focusItems[i].keyword = `${msg.focusItems[i].type}:${msg.focusItems[i].value}`;
        }
      }
      return (
        <div className="mt-2 flex flex-col gap-1 rounded-md">
          {/* ── 1️⃣ First row: avatar + message bubble ─────────────────────────────── */}
          <div className="flex gap-2">
            <div className="flex h-7 flex-shrink-0 items-center justify-center mt-1">
              <CircleUserRound className="text-neutral-600" size={20} />
            </div>

            <div className="max-w-full flex-1 overflow-hidden rounded-lg border border-[var(--vscode-editorWidget-border)] bg-[var(--vscode-editor-background)] p-2">
              {/* attachments (optional) */}
              {msg.attachments?.length > 0 && (
                <div className="mb-2 overflow-x-auto">
                  <div className="flex gap-2 pb-2" style={{ minWidth: 'fit-content' }}>
                    {msg.attachments.map(
                      (attachment: S3Object, imgIndex: number) =>
                        attachment.get_url && (
                          <ImageWithDownload
                            key={imgIndex}
                            src={attachment.get_url}
                            alt={`Attached content ${imgIndex + 1}`}
                            Key={attachment.key}
                            thumbnail
                          />
                        )
                    )}
                  </div>
                </div>
              )}

              {/* main text */}
              <span className="whitespace-pre-wrap break-words font-sans text-[var(--vscode-editor-foreground)]">
                {msg.content.text}
              </span>
            </div>
          </div>

          {/* ── 2️⃣ Second row: reference chips (only rendered if needed) ──────────── */}
          {(msg.activeFileReference || (msg.focusItems?.length ?? 0) > 0) && (
            <div className="flex items-start gap-2">
              {/* empty spacer keeps left edge aligned with the bubble,                  */}
              {/* matching avatar width + gap from row 1                                */}
              <div className="flex w-[21px] flex-shrink-0" />

              {/* chip container */}
              <div className="flex flex-wrap items-center gap-1">
                {msg.activeFileReference && (
                  <ActiveFileReferenceInChat activeFileReference={msg.activeFileReference} />
                )}

                {msg.focusItems?.map((item: ChatReferenceItem, chipIndex: number) => (
                  <QueryReferenceChip
                    key={chipIndex}
                    value={item.value}
                    type={item.type}
                    path={item.path}
                    chunks={item.chunks}
                    url={item.url}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }
    case 'ASSISTANT': {
      return (
        <div
          className={`markdown-body ${['high-contrast', 'high-contrast-light'].includes(themeKind) ? themeKind : ''}`}
        >
          <Markdown>{String(msg.content?.text)}</Markdown>
        </div>
      );
    }
  }
};

export default TextMessageChip;
