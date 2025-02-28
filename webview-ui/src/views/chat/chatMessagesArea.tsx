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
                <div key={index} className="flex items-center gap-2">
                  <CircleUserRound className="text-neutral-400" size={18} />
                  <span className='text-white'> {msg.content.text}</span>
                </div>
              );
            }

            if (msg.actor === 'ASSISTANT') {
              return (
                <div key={index} className='text-white'>
                  <Markdown>{msg.content?.text}</Markdown>
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
                  // is_diff={msg.is_diff}
                  content={msg.content.code}
                  inline={false}
                />
              </div>
            );

          case 'TOOL_USE_REQUEST_BLOCK':
            return (
              <div key={index} className="flex items-center justify-start">
                <div className="bg-purple-700 text-white p-2 rounded-lg max-w-xs break-words">
                  <div className="font-bold">Tool: {msg.content.tool_name}</div>
                  <div>
                    <span className="font-medium">Input: </span>
                    <pre className="text-sm whitespace-pre-wrap overflow-x-auto bg-purple-800 p-1 rounded">
                      <code>{msg.content.input_params_json || '—'}</code>
                    </pre>
                  </div>
                  <div>
                    <span className="font-medium">Status: </span>
                    <span className="inline-flex items-center">
                      {msg.content.status}
                      {msg.content.status === 'in-progress' && (
                        <span className="ml-2 inline-block w-3 h-3 border-2 border-t-transparent border-white rounded-full animate-spin"></span>
                      )}
                    </span>
                  </div>
                  {msg.content.result_json && (
                    <div>
                      <span className="font-medium">Result: </span>
                      <pre className="text-sm whitespace-pre-wrap overflow-x-auto bg-purple-800 p-1 rounded">
                        <code>{msg.content.result_json}</code>
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            );

          default:
            return null;
        }
      })}
    </>
  );
}
