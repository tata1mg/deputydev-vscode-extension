import { useThemeStore } from '@/stores/useThemeStore';
import Markdown from 'react-markdown';
import { useChatStore } from '../../stores/chatStore';
import '../../styles/markdown-body.css';
import { TaskCompletionChip } from './chatElements/toolChips/TaskCompletionChip';
import GeneratingLoader from './chatElements/chatLoader';
import { CodeActionPanel } from './chatElements/codeActionPanel';
import { Shimmer } from '../../components/Shimmer';
import ToolChipSelector from './chatElements/toolChips/ToolChipSelector';
import { ThinkingChip } from './chatElements/toolChips/ThinkingChip';
import ErrorChipSelector from './chatElements/errorChips/ErrorChipSelector';
import { TerminalNoShellIntegration } from './chatElements/toolChips/TerminalNoShellIntegrationChip';
import InfoChip from './chatElements/toolChips/InfoChip';
import TextMessageChip from './chatElements/toolChips/TextMessageChip';
import { TaskPlanChip } from './chatElements/toolChips/TaskPlanChip';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import {
  remarkPreventBoldFilenames,
  remarkUrlToLink,
} from './chatElements/toolChips/utils/RemarkPlugins';
import rehypeKatex from 'rehype-katex';
import { rehypeCodeActionPanelComponents } from './chatElements/toolChips/utils/RehypeOptions';

export function ChatArea() {
  const currentChatId = useChatStore((s) => s.currentChatId);
  const chat = useChatStore((s) => s.chats[currentChatId]);
  const sessionId = chat.sessionId;
  const { themeKind } = useThemeStore();

  const { history: messages, current, showSkeleton, showGeneratingEffect } = chat;

  return (
    <>
      {messages.map((msg, index) => {
        switch (msg.type) {
          case 'TEXT_BLOCK':
            return (
              <div key={index}>
                <TextMessageChip msg={msg} />
              </div>
            );

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
            return (
              <div key={index}>
                <ToolChipSelector
                  toolRequest={msg.content.toolRequest}
                  toolResponse={msg.content.toolResponse}
                  toolUseId={msg.content.tool_use_id}
                  toolRunStatus={msg.content.status}
                  terminal={msg.content.toolStateMetaData?.terminal}
                  isHistory={msg.content.isHistory}
                  sessionId={sessionId}
                />
              </div>
            );
          }

          case 'TASK_PLAN_UPSERT': {
            return (
              <div key={index}>
                <TaskPlanChip index={index} msg={msg} />
              </div>
            );
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
          className={`markdown-body text-base ${
            ['high-contrast', 'high-contrast-light'].includes(themeKind) ? themeKind : ''
          }`}
        >
          <Markdown
            remarkPlugins={[remarkGfm, remarkMath, remarkUrlToLink, remarkPreventBoldFilenames]}
            rehypePlugins={[rehypeKatex]}
            components={{
              ...rehypeCodeActionPanelComponents,
              table: ({ node, ...props }) => (
                <div style={{ overflowX: 'auto' }}>
                  <table {...props} />
                </div>
              ),
            }}
          >
            {current.content.text}
          </Markdown>
        </div>
      )}
    </>
  );
}
