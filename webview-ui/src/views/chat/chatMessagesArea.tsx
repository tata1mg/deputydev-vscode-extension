import { CircleUserRound } from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useChatSettingStore, useChatStore } from "../../stores/chatStore";
import "../../styles/markdown-body.css";
import {
  AnalyzedCodeItem,
  SearchedCodebase,
  ThinkingChip,
} from "./chatElements/AnalysisChips";
import { CodeActionPanel } from "./chatElements/codeActionPanel";

export function ChatArea() {
  const { history: messages, current } = useChatStore();

  return (
    <>
      {messages.map((msg, index) => {
        switch (msg.type) {
          case "TEXT_BLOCK":
            if (msg.actor === "USER") {
              return (
                <div key={index} className="flex items-start gap-2">
                  <div className="w-7 h-7 flex items-center justify-center flex-shrink-0">
                    <CircleUserRound className="text-neutral-400" size={20} />
                  </div>
                  <pre className="text-white whitespace-pre-wrap break-words mt-1 m-0 p-0 font-sans">
                    {msg.content.text}
                  </pre>
                </div>
              );
            }
            if (msg.actor === "ASSISTANT") {
              return (
                <div key={index} className="text-white markdown-body">
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

          case "CODE_BLOCK":
            return (
              <div key={index} className="text-white">
                <CodeActionPanel
                  language={msg.content.language}
                  filepath={msg.content.file_path}
                  is_diff={msg.content.is_diff} // ✅ fixed here
                  content={msg.content.code}
                  inline={false}
                  diff={msg.content.diff}
                  added_lines={msg.content.added_lines}
                  removed_lines={msg.content.removed_lines}
                />
              </div>
            );

          case "TOOL_USE_REQUEST_BLOCK":
            return (
              <div key={index}>
                <SearchedCodebase status={msg.content.status} />
              </div>
            );

          default:
            return null;
        }
      })}

      {current && typeof current.content?.text === "string" && (
        <div key="streaming" className="text-white text-base markdown-body">
          <Markdown>{current.content.text}</Markdown>
        </div>
      )}
    </>
  );
}
