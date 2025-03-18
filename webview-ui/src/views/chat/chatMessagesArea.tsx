import { CircleUserRound } from "lucide-react";
import React, { useEffect, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useChatSettingStore, useChatStore } from "../../stores/chatStore";
import "../../styles/markdown-body.css";
import {
  SearchedCodebase,
  ThinkingChip,
  FileEditedChip,
} from "./chatElements/ToolChips";
import { CodeActionPanel } from "./chatElements/codeActionPanel";
import { Shimmer } from "./chatElements/shimmerEffect";
import ReferenceChip from "./referencechip";

export function ChatArea() {
  const { history: messages, current, showSkeleton } = useChatStore();
  console.log("messages in parser", messages);

  return (
    <>
      {messages.map((msg, index) => {
        switch (msg.type) {
          case "TEXT_BLOCK":
            if (msg.actor === "USER") {
              if (msg.content.focus_items?.length) {
                msg.referenceList = msg.content.focus_items;
                for (let i = 0; i < msg.referenceList.length; i++) {
                  msg.referenceList[i].index = i;
                  msg.referenceList[i].keyword = `${msg.referenceList[i].type}:${msg.referenceList[i].value}`;
                }
              }
              return (
                <div
                  key={index}
                  className="flex items-start gap-2 rounded-md p-2"
                >
                  <div className="h-7 flex items-center justify-center flex-shrink-0">
                    <CircleUserRound className="text-neutral-600" size={20} />
                  </div>
                  <div
                    className="flex-1 overflow-hidden max-w-full rounded-lg p-3 border"
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
                          onDelete={() => {}}
                          setShowAutoComplete={() => {}}
                          displayOnly={true}
                          path={reference.path}
                          chunks={reference.chunks}
                        />
                      ))}
                      <span className="text-[var(--vscode-editor-foreground)] whitespace-pre-wrap break-words m-0 p-0 font-sans">
                        {msg.content.text}
                      </span>
                    </p>
                  </div>
                </div>
              );
            }
            if (msg.actor === "ASSISTANT") {
              return (
                <div key={index} className=" markdown-body">
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
            if (msg.write_mode && msg.content.is_diff) {
              return (
                <div key={index}>
                  <FileEditedChip
                    filepath={msg.content.file_path}
                    added_lines={msg.content.added_lines}
                    removed_lines={msg.content.removed_lines}
                    status={msg.status}
                  />
                </div>
              );
            } else {
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
            }

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

      {showSkeleton && <Shimmer />}
      {current && typeof current.content?.text === "string" && (
        <div key="streaming" className=" text-base markdown-body">
          <Markdown>{current.content.text}</Markdown>
        </div>
      )}
    </>
  );
}
