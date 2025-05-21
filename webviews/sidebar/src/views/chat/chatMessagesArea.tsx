import { CircleUserRound, TriangleAlert, ThumbsUp, ThumbsDown } from 'lucide-react';
import Markdown from 'react-markdown';
import { useChatStore } from '../../stores/chatStore';
import '../../styles/markdown-body.css';
import {
  ToolUseStatusMessage,
  ThinkingChip,
  FileEditedChip,
  RetryChip,
} from './chatElements/ToolChips';
import { CodeActionPanel } from './chatElements/codeActionPanel';
import { Shimmer } from './chatElements/shimmerEffect';
import ReferenceChip from './referencechip';
import { TerminalPanel } from './chatElements/TerminalPanel';
import { JSX, useRef } from 'react';
import { useThemeStore } from '@/stores/useThemeStore';
import { submitFeedback } from '@/commandApi';
import * as Tooltip from '@radix-ui/react-tooltip';
import { CreateNewWorkspace } from './chatElements/CreateNewWorkspace';
import { ChatMessage } from '@/types';
import { IterativeFileReader } from './chatElements/Tools/IterativeFileReader';

export function ChatArea() {
  const { history: messages, current, showSkeleton, showSessionsBox } = useChatStore();
  const { themeKind } = useThemeStore();
  const queryCompleteTimestampsRef = useRef(new Map());
  const queryIdMap = new Map();
  let queryId: number;

  return (
    <>
      {messages.map((msg, index) => {
        switch (msg.type) {
          case 'RESPONSE_METADATA': {
            queryId = msg.content.query_id;
            break;
          }
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
                <div key={index} className="flex items-start gap-2 rounded-md p-2">
                  <div className="flex h-7 flex-shrink-0 items-center justify-center">
                    <CircleUserRound className="text-neutral-600" size={20} />
                  </div>
                  <div
                    className="max-w-full flex-1 overflow-hidden rounded-lg border p-3"
                    style={{
                      backgroundColor: 'var(--vscode-editor-background)',
                      borderColor: 'var(--vscode-editorWidget-border)',
                    }}
                  >
                    <p className="space-x-1 space-y-1">
                      {msg.referenceList?.map((reference, chipIndex) => (
                        <ReferenceChip
                          key={chipIndex}
                          chipIndex={chipIndex}
                          initialText={reference.keyword}
                          onDelete={() => {}}
                          setShowAutoComplete={() => {}}
                          displayOnly={true}
                          path={reference.path}
                          chunks={reference.chunks}
                          url={reference.url}
                        />
                      ))}
                      <span className="m-0 whitespace-pre-wrap break-words p-0 font-sans text-[var(--vscode-editor-foreground)]">
                        {msg.content.text}
                      </span>
                    </p>
                  </div>
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
                <ThinkingChip completed={msg.completed} />
              </div>
            );

          case 'CODE_BLOCK_STREAMING':
          case 'CODE_BLOCK': {
            const isStreaming = msg.type === 'CODE_BLOCK_STREAMING';
            const isDiff = msg.content.is_diff;
            const showFileEditedChip = isDiff && msg.write_mode;

            if (showFileEditedChip) {
              return (
                <div key={index}>
                  <FileEditedChip
                    filepath={msg.content.file_path}
                    language={msg.content.language}
                    content={msg.content.code}
                    added_lines={msg.content.added_lines}
                    removed_lines={msg.content.removed_lines}
                    status={isStreaming ? msg.status : 'idle'}
                    past_session={!isStreaming}
                  />
                </div>
              );
            }

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
                  is_live_chat={msg.content.is_live_chat}
                />
              </div>
            );
          }

          case 'TOOL_USE_REQUEST': {
            let contentComponent: JSX.Element;

            switch (msg.content.tool_name) {
              case 'execute_command':
                contentComponent = (
                  <TerminalPanel
                    tool_id={msg.content.tool_use_id}
                    terminal_command={(msg.content.input_params_json as string) || ''}
                    status={msg.content.status}
                    show_approval_options={msg.content.terminal_approval_required}
                  />
                );
                break;

              case 'create_new_workspace':
                contentComponent = (
                  <CreateNewWorkspace
                    tool_id={msg.content.tool_use_id}
                    status={msg.content.status || 'pending'}
                  />
                );
                break;
              case 'iterative_file_reader':
                contentComponent = (
                  <IterativeFileReader
                    status={msg.content.status}
                    tool_name={msg.content.tool_name}
                    toolInputJson={msg.content.input_params_json as string}
                  />
                );
                break;

              default:
                contentComponent = (
                  <ToolUseStatusMessage
                    status={msg.content.status}
                    tool_name={msg.content.tool_name}
                  />
                );
                break;
            }

            return <div key={index}>{contentComponent}</div>;
          }
          case 'TOOL_USE_REQUEST_BLOCK':
            return (
              <div
                key={index}
                className={`markdown-body ${['high-contrast', 'high-contrast-light'].includes(themeKind) ? themeKind : ''}`}
              >
                {msg.content.tool_name === 'ask_user_input' ? (
                  <Markdown>{msg.content.tool_input_json?.prompt}</Markdown>
                ) : null}
              </div>
            );

          case 'QUERY_COMPLETE': {
            if (!queryCompleteTimestampsRef.current.has(index)) {
              const elapsed = msg.content.elapsedTime;

              if (elapsed !== null) {
                queryCompleteTimestampsRef.current.set(index, elapsed);
              }
            }

            const rawElapsed = queryCompleteTimestampsRef.current.get(index);
            let timeElapsed;

            if (rawElapsed != null) {
              const totalSeconds = Math.round(rawElapsed / 1000);
              if (totalSeconds >= 60) {
                const min = Math.floor(totalSeconds / 60);
                const sec = totalSeconds % 60;
                timeElapsed = `${min} min ${Math.floor(sec)} sec`;
              } else {
                timeElapsed = `${Math.floor(totalSeconds)} sec`;
              }
            }

            queryIdMap.set(index, queryId);
            const feedback = msg.content.feedbackState;
            return (
              <div key={index} className="mt-1.5 flex items-center justify-between font-medium">
                <div className="flex items-center space-x-2 text-green-500">
                  <span>✓</span>
                  {timeElapsed !== null ? (
                    <span>{`Task Completed in ${timeElapsed}.`}</span>
                  ) : (
                    <span>Task Completed</span>
                  )}
                </div>
                <div className="flex items-center space-x-3">
                  {/* Thumbs up */}
                  <Tooltip.Provider>
                    <Tooltip.Root>
                      <Tooltip.Trigger>
                        <div className={`${feedback === 'UPVOTE' && 'animate-thumbs-up'}`}>
                          <ThumbsUp
                            className={`h-4 w-4 cursor-pointer ${
                              feedback === 'UPVOTE'
                                ? 'fill-green-500 text-green-500'
                                : 'hover:fill-green-500 hover:text-green-500'
                            }`}
                            onClick={() => {
                              if (feedback !== 'UPVOTE') {
                                const updatedMessages = useChatStore
                                  .getState()
                                  .history.map((m, i) => {
                                    if (i !== index) return m;
                                    if (
                                      m.type === 'QUERY_COMPLETE' ||
                                      (m.type === 'TEXT_BLOCK' && m.actor === 'ASSISTANT')
                                    ) {
                                      return {
                                        ...m,
                                        content: {
                                          ...m.content,
                                          feedbackState: 'UPVOTE',
                                        },
                                      };
                                    }

                                    return m;
                                  });

                                useChatStore.setState({
                                  history: updatedMessages as ChatMessage[],
                                });
                                submitFeedback('UPVOTE', queryIdMap.get(index));
                              }
                            }}
                          />
                        </div>
                      </Tooltip.Trigger>
                      <Tooltip.Portal>
                        <Tooltip.Content
                          side="top"
                          className="rounded-md px-2 py-1 text-xs shadow-md"
                          style={{
                            backgroundColor: 'var(--vscode-editorHoverWidget-background)',
                            color: 'var(--vscode-editorHoverWidget-foreground)',
                            border: '1px solid var(--vscode-editorHoverWidget-border)',
                          }}
                        >
                          Like
                        </Tooltip.Content>
                      </Tooltip.Portal>
                    </Tooltip.Root>
                  </Tooltip.Provider>

                  {/* Thumbs down */}
                  <Tooltip.Provider>
                    <Tooltip.Root>
                      <Tooltip.Trigger>
                        <div className={`${feedback === 'DOWNVOTE' && 'animate-thumbs-down'}`}>
                          <ThumbsDown
                            className={`h-4 w-4 cursor-pointer ${
                              feedback === 'DOWNVOTE'
                                ? 'fill-red-500 text-red-500'
                                : 'hover:fill-red-500 hover:text-red-500'
                            }`}
                            onClick={() => {
                              if (feedback !== 'DOWNVOTE') {
                                const updatedMessages = useChatStore
                                  .getState()
                                  .history.map((m, i) => {
                                    if (i !== index) return m;
                                    if (
                                      m.type === 'QUERY_COMPLETE' ||
                                      (m.type === 'TEXT_BLOCK' && m.actor === 'ASSISTANT')
                                    ) {
                                      return {
                                        ...m,
                                        content: {
                                          ...m.content,
                                          feedbackState: 'DOWNVOTE',
                                        },
                                      };
                                    }
                                    return m;
                                  });

                                useChatStore.setState({
                                  history: updatedMessages as ChatMessage[],
                                });

                                submitFeedback('DOWNVOTE', queryIdMap.get(index));
                              }
                            }}
                          />
                        </div>
                      </Tooltip.Trigger>
                      <Tooltip.Portal>
                        <Tooltip.Content
                          side="top"
                          className="rounded-md px-2 py-1 text-xs shadow-md"
                          style={{
                            backgroundColor: 'var(--vscode-editorHoverWidget-background)',
                            color: 'var(--vscode-editorHoverWidget-foreground)',
                            border: '1px solid var(--vscode-editorHoverWidget-border)',
                          }}
                        >
                          Dislike
                        </Tooltip.Content>
                      </Tooltip.Portal>
                    </Tooltip.Root>
                  </Tooltip.Provider>
                </div>
              </div>
            );
          }
          case 'TERMINAL_NO_SHELL_INTEGRATION':
            return (
              <div
                key={index}
                className={`mt-2 flex flex-col items-start gap-1.5 rounded-md ${['light', 'high-contrast-light'].includes(themeKind) ? 'bg-yellow-200/80' : 'bg-yellow-800/40'} px-3 py-2`}
              >
                <div
                  className={`flex items-center ${['light', 'high-contrast-light'].includes(themeKind) ? 'text-gray-900' : 'text-yellow-500'} gap-2`}
                >
                  <TriangleAlert className="h-4 w-4" />
                  <p className="text-sm font-medium">Shell Integration Unavailable</p>
                </div>
                <div className="text-xs">
                  DeputyDev won't be able to view the command's output. Please update VSCode (
                  <kbd>CMD/CTRL + Shift + P</kbd> → "Update") and make sure you're using a supported
                  shell: zsh, bash, or PowerShell (<kbd>CMD/CTRL + Shift + P</kbd> → "Terminal:
                  Select Default Profile").{' '}
                  <a
                    href="https://code.visualstudio.com/docs/terminal/shell-integration"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    Still having trouble?
                  </a>
                </div>
              </div>
            );

          case 'ERROR':
            return (
              <div key={index}>
                <RetryChip
                  error_msg={msg.error_msg}
                  retry={msg.retry}
                  payload_to_retry={msg.payload_to_retry}
                />
              </div>
            );

          default:
            return null;
        }
      })}

      {showSkeleton && showSessionsBox === false && <Shimmer />}
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
