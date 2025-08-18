import { useThemeStore } from '@/stores/useThemeStore';
import { ChatReferenceItem, S3Object } from '@/types';
import { CircleUserRound, TriangleAlert } from 'lucide-react';
import { JSX } from 'react';
import Markdown from 'react-markdown';
import { useChatStore } from '../../stores/chatStore';
import '../../styles/markdown-body.css';
import { TaskCompletionChip } from './chatElements/toolChips/TaskCompletionChip';
import { TerminalPanelHistory } from './chatElements/toolChips/TerminalPanelHistory';
import ActiveFileReferenceInChat from './chatElements/autocomplete/ActiveFileReferenceInChat';
import QueryReferenceChip from './chatElements/autocomplete/referencechip';
import GeneratingLoader from './chatElements/chatLoader';
import { CodeActionPanel } from './chatElements/codeActionPanel';
import { ImageWithDownload } from './chatElements/imageView';
import { Shimmer } from '../../components/Shimmer';
import ToolChipSelector from './chatElements/toolChips/ToolChipSelector';
import { ThinkingChip } from './chatElements/toolChips/ThinkingChip';
import { FileEditedChip } from './chatElements/toolChips/FileEditedChip';
import ErrorChipSelector from './chatElements/errorChips/ErrorChipSelector';
import { TerminalNoShellIntegration } from './chatElements/toolChips/TerminalNoShellIntegrationChip';

export function ChatArea() {
  const { history: messages, current, showSkeleton, showGeneratingEffect } = useChatStore();
  const { themeKind } = useThemeStore();

  return (
    <>
      {messages.map((msg, index) => {
        switch (msg.type) {
          case 'TEXT_BLOCK':
            if (msg.actor === 'USER') {
              if (msg.content.focus_items?.length) {
                msg.referenceList = msg.content.focus_items;
                for (let i = 0; i < msg.referenceList.length; i++) {
                  msg.referenceList[i].index = i;
                  msg.referenceList[i].keyword =
                    `${msg.referenceList[i].type}:${msg.referenceList[i].value}`;
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
                      {msg.s3References?.length > 0 && (
                        <div className="mb-2 overflow-x-auto">
                          <div className="flex gap-2 pb-2" style={{ minWidth: 'fit-content' }}>
                            {msg.s3References.map(
                              (s3Ref: S3Object, imgIndex: number) =>
                                s3Ref.get_url && (
                                  <ImageWithDownload
                                    key={imgIndex}
                                    src={s3Ref.get_url}
                                    alt={`Attached content ${imgIndex + 1}`}
                                    Key={s3Ref.key}
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
                  {(msg.activeFileReference || (msg.referenceList?.length ?? 0) > 0) && (
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

                        {msg.referenceList?.map(
                          (reference: ChatReferenceItem, chipIndex: number) => (
                            <QueryReferenceChip
                              key={chipIndex}
                              value={reference.value}
                              type={reference.type}
                              path={reference.path}
                              chunks={reference.chunks}
                              url={reference.url}
                            />
                          )
                        )}
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
                />
              </div>
            );
            return contentComponent;
          }

          // case 'TOOL_USE_REQUEST_BLOCK': {
          //   let contentComponent: JSX.Element | null = null;

          //   switch (msg.content.tool_name) {
          //     case 'ask_user_input':
          //       contentComponent = (
          //         <div
          //           key={index}
          //           className={`markdown-body ${
          //             ['high-contrast', 'high-contrast-light'].includes(themeKind) ? themeKind : ''
          //           }`}
          //         >
          //           <Markdown>
          //             {typeof msg.content.tool_input_json === 'object' &&
          //             msg.content.tool_input_json?.prompt
          //               ? String(msg.content.tool_input_json.prompt)
          //               : typeof msg.content.tool_input_json === 'string'
          //                 ? msg.content.tool_input_json
          //                 : 'Awaiting input...'}
          //           </Markdown>
          //         </div>
          //       );
          //       break;

          //     case 'replace_in_file': {
          //       const isStreaming = false;
          //       const inputParams = msg.content.tool_input_json as unknown as {
          //         path: string;
          //         diff: any;
          //       };
          //       contentComponent = (
          //         <FileEditedChip
          //           key={index}
          //           isToolUse={true}
          //           isWriteToFileTool={false}
          //           content={JSON.stringify(inputParams)}
          //           status={isStreaming ? msg.content.status : 'idle'}
          //           addedLines={msg.content.diff?.addedLines}
          //           removedLines={msg.content.diff?.removedLines}
          //           isStreaming={isStreaming}
          //         />
          //       );
          //       break;
          //     }
          //     case 'execute_command': {
          //       const inputParams = msg.content.tool_input_json as unknown as {
          //         command: string;
          //         is_long_running: boolean;
          //         terminal_approval_required: boolean;
          //       };
          //       contentComponent = (
          //         <TerminalPanelHistory
          //           tool_id={msg.content.tool_use_id}
          //           terminal_command={inputParams.command}
          //           status={msg.content.status || 'history'}
          //         />
          //       );
          //       break;
          //     }
          //     case 'write_to_file': {
          //       const isStreaming = false;
          //       const inputParams = msg.content.tool_input_json as unknown as {
          //         path: string;
          //         diff: any;
          //       };
          //       contentComponent = (
          //         <FileEditedChip
          //           key={index}
          //           isToolUse={true}
          //           isWriteToFileTool={true}
          //           content={JSON.stringify(inputParams)}
          //           status={isStreaming ? msg.content.status : 'idle'}
          //           addedLines={msg.content.diff?.addedLines}
          //           removedLines={msg.content.diff?.removedLines}
          //           isStreaming={isStreaming}
          //         />
          //       );
          //       break;
          //     }
          //   }

          //   return contentComponent;
          // }

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
