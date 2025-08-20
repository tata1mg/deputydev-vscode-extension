import { useThemeStore } from '@/stores/useThemeStore';
import { ChatReferenceItem, S3Object } from '@/types';
import { CircleUserRound } from 'lucide-react';
import Markdown from 'react-markdown';
import { useChatStore } from '../../stores/chatStore';
import '../../styles/markdown-body.css';
import { TaskCompletionChip } from './chatElements/toolChips/TaskCompletionChip';
import ActiveFileReferenceInChat from './chatElements/autocomplete/ActiveFileReferenceInChat';
import QueryReferenceChip from './chatElements/autocomplete/referencechip';
import GeneratingLoader from './chatElements/chatLoader';
import { CodeActionPanel } from './chatElements/codeActionPanel';
import { ImageWithDownload } from './chatElements/imageView';
import { Shimmer } from '../../components/Shimmer';
import ToolChipSelector from './chatElements/toolChips/ToolChipSelector';
import { ThinkingChip } from './chatElements/toolChips/ThinkingChip';
import ErrorChipSelector from './chatElements/errorChips/ErrorChipSelector';
import { TerminalNoShellIntegration } from './chatElements/toolChips/TerminalNoShellIntegrationChip';
import InfoChip from './chatElements/toolChips/InfoChip';

export function ChatArea() {
  const { history: messages, current, showSkeleton, showGeneratingEffect } = useChatStore();
  const { themeKind } = useThemeStore();

  return (
    <>
      {messages.map((msg, index) => {
        switch (msg.type) {
          case 'TEXT_BLOCK':
            if (msg.actor === 'USER') {
              if (msg.focusItems && msg.focusItems.length > 0) {
                for (let i = 0; i < msg.focusItems.length; i++) {
                  msg.focusItems[i].index = i;
                  msg.focusItems[i].keyword =
                    `${msg.focusItems[i].type}:${msg.focusItems[i].value}`;
                }
              }
              return (
                <div key={index} className="flex flex-col gap-1 rounded-md p-2">
                  {/* ── 1️⃣ First row: avatar + message bubble ─────────────────────────────── */}
                  <div className="flex items-start gap-2">
                    <div className="flex h-7 flex-shrink-0 items-center justify-center">
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
                          <ActiveFileReferenceInChat
                            activeFileReference={msg.activeFileReference}
                          />
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

            if (msg.actor === 'ASSISTANT') {
              return (
                <div
                  key={index}
                  className={`markdown-body ${['high-contrast', 'high-contrast-light'].includes(themeKind) ? themeKind : ''}`}
                >
                  <Markdown>{String(msg.content?.text)}</Markdown>
                </div>
              );
            }
            break;

          case 'THINKING':
            return (
              <div key={index}>
                <ThinkingChip status={msg.status} thinkingText={msg.text} />
              </div>
            );

          case 'CODE_BLOCK_STREAMING':
          case 'CODE_BLOCK': {
            const isStreaming = msg.type === 'CODE_BLOCK_STREAMING';
            return (
              <div key={index} className="text-white">
                <CodeActionPanel
                  language={msg.content.language}
                  filepath={msg.content.file_path}
                  is_diff={msg.content.is_diff}
                  content={msg.content.code}
                  inline={false}
                  diff={msg.content.diff}
                  added_lines={msg.content.added_lines}
                  removed_lines={msg.content.removed_lines}
                  isStreaming={isStreaming}
                />
              </div>
            );
          }

          case 'TOOL_CHIP_UPSERT': {
            const contentComponent = (
              <div key={index}>
                <ToolChipSelector
                  toolRequest={msg.content.toolRequest}
                  toolResponse={msg.content.toolResponse}
                  toolUseId={msg.content.tool_use_id}
                  toolRunStatus={msg.content.status}
                  terminal={msg.content.toolStateMetaData?.terminal}
                  isHistory={msg.content.isHistory}
                />
              </div>
            );
            return contentComponent;
          }

          case 'TERMINAL_NO_SHELL_INTEGRATION': {
            return (
              <div key={index}>
                <TerminalNoShellIntegration />
              </div>
            );
          }

          case 'TASK_COMPLETION': {
            return (
              <div key={index}>
                <TaskCompletionChip index={index} msg={msg} />
              </div>
            );
          }

          case 'INFO': {
            return (
              <div key={index}>
                <InfoChip info={msg.content.info} />
              </div>
            );
          }

          case 'ERROR': {
            return (
              <div key={index}>
                <ErrorChipSelector msg={msg} />
              </div>
            );
          }

          default:
            return null;
        }
      })}

      {/* Render Generating Loader */}
      {showGeneratingEffect && !showSkeleton && <GeneratingLoader text="Generating" />}

      {/* Render Shimmer */}
      {showSkeleton && <Shimmer />}

      {/* Render Streaming Text */}
      {current && typeof current.content?.text === 'string' && (
        <div
          key="streaming"
          className={`markdown-body text-base ${['high-contrast', 'high-contrast-light'].includes(themeKind) ? themeKind : ''}`}
        >
          <Markdown>{current.content.text}</Markdown>
        </div>
      )}
    </>
  );
}
