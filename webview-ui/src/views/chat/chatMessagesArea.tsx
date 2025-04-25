import { CircleUserRound, ThumbsUp, ThumbsDown } from "lucide-react";
import Markdown from "react-markdown";
import { useChatStore } from "../../stores/chatStore";
import "../../styles/markdown-body.css";
import {
  SearchedCodebase,
  ThinkingChip,
  FileEditedChip,
  RetryChip,
} from "./chatElements/ToolChips";
import { CodeActionPanel } from "./chatElements/codeActionPanel";
import { Shimmer } from "./chatElements/shimmerEffect";
import ReferenceChip from "./referencechip";
import { useRef } from "react";
import { useThemeStore } from "@/stores/useThemeStore";
import { submitFeedback } from "@/commandApi";

export function ChatArea() {
  const {
    history: messages,
    current,
    showSkeleton,
    showSessionsBox,
  } = useChatStore();
  const { themeKind } = useThemeStore();
  const queryCompleteTimestampsRef = useRef(new Map());
  const queryIdMap = new Map();
  let queryId: number;

  // console.log("messages in parser", messages);

  return (
    <>
      {messages.map((msg, index) => {
        switch (msg.type) {
          case "RESPONSE_METADATA": {
            queryId = msg.content.query_id;
            break;
          }
          case "TEXT_BLOCK":
            if (msg.actor === "USER") {
              if (msg.content.focus_items?.length) {
                msg.referenceList = msg.content.focus_items;
                for (let i = 0; i < msg.referenceList.length; i++) {
                  msg.referenceList[i].index = i;
                  msg.referenceList[i].keyword =
                    `${msg.referenceList[i].type}:${msg.referenceList[i].value}`;
                }
              }
              return (
                <div
                  key={index}
                  className="flex items-start gap-2 rounded-md p-2"
                >
                  <div className="flex h-7 flex-shrink-0 items-center justify-center">
                    <CircleUserRound className="text-neutral-600" size={20} />
                  </div>
                  <div
                    className="max-w-full flex-1 overflow-hidden rounded-lg border p-3"
                    style={{
                      backgroundColor: "var(--vscode-editor-background)",
                      borderColor: "var(--vscode-editorWidget-border)",
                    }}
                  >
                    <p className="space-x-1 space-y-1">
                      {msg.referenceList?.map((reference, chipIndex) => (
                        <ReferenceChip
                          key={chipIndex}
                          chipIndex={chipIndex}
                          initialText={reference.keyword}
                          onDelete={() => { }}
                          setShowAutoComplete={() => { }}
                          displayOnly={true}
                          path={reference.path}
                          chunks={reference.chunks}
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
            if (msg.actor === "ASSISTANT") {
              return (
                <div
                  key={index}
                  className={`markdown-body ${["high-contrast", "high-contrast-light"].includes(themeKind) ? themeKind : ""}`}
                >
                  <Markdown>{String(msg.content?.text)}</Markdown>
                </div>
              );
            }

          case "THINKING":
            return (
              <div key={index}>
                <ThinkingChip completed={msg.completed} />
              </div>
            );

          case "CODE_BLOCK_STREAMING":
          case "CODE_BLOCK": {
            const isStreaming = msg.type === "CODE_BLOCK_STREAMING";
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
                    status={isStreaming ? msg.status : "idle"}
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

          case "TOOL_USE_REQUEST":
            return (
              <div key={index}>
                <SearchedCodebase status={msg.content.status} />
              </div>
            );

          case "TOOL_USE_REQUEST_BLOCK":
            return (
              <div
                key={index}
                className={`markdown-body ${["high-contrast", "high-contrast-light"].includes(themeKind) ? themeKind : ""}`}
              >
                {msg.content.tool_name === "ask_user_input" ? (
                  <Markdown>{msg.content.tool_input_json?.prompt}</Markdown>
                ) : null}
              </div>
            );

          case "QUERY_COMPLETE": {
            // If no timestamp has been recorded for this message, record one now
            if (!queryCompleteTimestampsRef.current.has(index)) {
              const last = useChatStore.getState().lastMessageSentTime;
              const elapsed = last
                ? new Date().getTime() - last.getTime()
                : null;

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

            return (
              <div
                key={index}
                className="mt-1 flex items-center justify-between font-medium text-green-500"
              >
                <div className="flex items-center space-x-2">
                  <span>✓</span>
                  {timeElapsed !== null ? (
                    <span>{`Task Completed in ${timeElapsed}.`}</span>
                  ) : (
                    <span>Task Completed</span>
                  )}
                </div>
                <div className="flex items-center space-x-3">
                  <ThumbsUp
                      className="cursor-pointer h-4 w-4 hover:text-green-500 hover:fill-green-500"
                    onClick={() => {
                      submitFeedback("UPVOTE", queryIdMap.get(index))
                    }}
                  />
                  <ThumbsDown
                    className="cursor-pointer h-4 w-4 hover:text-green-500 hover:fill-green-500"
                    onClick={() => {
                      submitFeedback("DOWNVOTE", queryIdMap.get(index))
                    }}
                  />
                </div>
              </div>
            );
          }

          case "ERROR":
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
      {current && typeof current.content?.text === "string" && (
        <div
          key="streaming"
          className={`markdown-body text-base ${["high-contrast", "high-contrast-light"].includes(themeKind) ? themeKind : ""}`}
        >
          <Markdown>{current.content.text}</Markdown>
        </div>
      )}
    </>
  );
}
