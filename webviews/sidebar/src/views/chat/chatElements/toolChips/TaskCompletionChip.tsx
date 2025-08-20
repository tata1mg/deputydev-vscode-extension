import React from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { useChatStore } from '@/stores/chatStore';
import { ChatCompleteMessage, ChatMessage } from '@/types';
import { submitFeedback } from '@/commandApi';

type TaskCompletionChipProps = {
  index: number;
  msg: ChatCompleteMessage;
};

export const TaskCompletionChip: React.FC<TaskCompletionChipProps> = ({ index, msg }) => {
  const { elapsedTime, feedbackState: feedback, queryId, success } = msg.content;
  let statusText = '';
  let statusColor = '';

  if (success === false) {
    statusText = 'Task Failed';
    statusColor = 'text-red-500';
  } else {
    statusColor = 'text-green-500';
    if (elapsedTime != null) {
      const totalSeconds = Math.floor(elapsedTime / 1000);
      if (totalSeconds >= 60) {
        const min = Math.floor(totalSeconds / 60);
        const sec = totalSeconds % 60;
        statusText = `Task Completed in ${min} min ${sec > 0 ? `${sec} sec` : ''}.`;
      } else {
        statusText = `Task Completed in ${totalSeconds} sec.`;
      }
    } else {
      statusText = 'Task Completed';
    }
  }

  const handleFeedbackClick = (type: 'UPVOTE' | 'DOWNVOTE') => {
    if (feedback !== type) {
      const updatedMessages = useChatStore.getState().history.map((m, i) => {
        if (i !== index) return m;
        if (m.type === 'TASK_COMPLETION' || (m.type === 'TEXT_BLOCK' && m.actor === 'ASSISTANT')) {
          return {
            ...m,
            content: {
              ...m.content,
              feedbackState: type,
            },
          };
        }
        return m;
      });

      useChatStore.setState({ history: updatedMessages as ChatMessage[] });
      submitFeedback(type, queryId);
    }
  };

  return (
    <div className="mt-1.5 flex items-center justify-between font-medium">
      <div className={`flex items-center space-x-2 ${statusColor}`}>
        <span>{success === false ? '✗' : '✓'}</span>
        <span>{statusText}</span>
      </div>
      <div className="flex items-center space-x-3">
        {/* Thumbs Up */}
        <Tooltip.Provider>
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <div className={feedback === 'UPVOTE' ? 'animate-thumbs-up' : ''}>
                <ThumbsUp
                  className={`h-4 w-4 cursor-pointer ${
                    feedback === 'UPVOTE'
                      ? 'fill-green-500 text-green-500'
                      : 'hover:fill-green-500 hover:text-green-500'
                  }`}
                  onClick={() => handleFeedbackClick('UPVOTE')}
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

        {/* Thumbs Down */}
        <Tooltip.Provider>
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <div className={feedback === 'DOWNVOTE' ? 'animate-thumbs-down' : ''}>
                <ThumbsDown
                  className={`h-4 w-4 cursor-pointer ${
                    feedback === 'DOWNVOTE'
                      ? 'fill-red-500 text-red-500'
                      : 'hover:fill-red-500 hover:text-red-500'
                  }`}
                  onClick={() => handleFeedbackClick('DOWNVOTE')}
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
};
