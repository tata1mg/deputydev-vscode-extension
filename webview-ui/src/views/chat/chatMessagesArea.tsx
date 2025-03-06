import { CircleUserRound } from 'lucide-react';
import Markdown from 'react-markdown';
import { CodeActionPanel } from './chatElements/codeActionPanel';
import { AnalyzedCodeItem, SearchedCodebase, ThinkingChip } from './chatElements/AnalysisChips';
import { useChatStore, useChatSettingStore } from '../../stores/chatStore';


export function ChatArea() {
  const { history: messages } = useChatStore();

  return (
    <>
      {messages.map((msg, index) => {
        switch (msg.type) {
          case 'TEXT_BLOCK':
            if (msg.actor === 'USER') {
              return (
                <div key={index} className="flex items-start gap-2">
                  <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                    <CircleUserRound className="text-neutral-400" size={18} />
                  </div>
                  <pre className="text-white whitespace-pre-wrap break-words">
                    {msg.content.text}
                  </pre>
                </div>
              );
            }

            if (msg.actor === 'ASSISTANT') {
              return (
                <div key={index} className="text-white">
                  <Markdown>{String(msg.content?.text)}</Markdown>
                </div>
              );
            }



          case 'THINKING':
            return (
              <div key={index} >
                <ThinkingChip completed={msg.completed} />
              </div>
            );


            case 'CODE_BLOCK':
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
            
            case 'TOOL_USE_REQUEST_BLOCK':
              return (
                <div key={index}>
                  <SearchedCodebase status={msg.content.status} />
                </div>
              );
            

          default:
            return null;
        }
      })}
    </>
  );
}
