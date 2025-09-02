import { RotateCw, XCircle } from 'lucide-react';
import { useChatStore } from '@/stores/chatStore';
import { useLLMModelStore } from '@/stores/llmModelStore';

export function RetryChip({
  error_msg,
  retry,
  payload_to_retry,
}: {
  error_msg: string;
  retry: boolean;
  payload_to_retry: unknown;
}) {
  const { history: messages, sendChatMessage } = useChatStore();
  const { activeModel } = useLLMModelStore();
  // Retry function defined within ChatArea component
  const retryChat = () => {
    if (!messages.length) {
      // console.log("No messages in history");
      return;
    }
    // Get the last message from the chat history
    const lastMsg = messages[messages.length - 1];
    // console.log("Last message:", JSON.stringify(lastMsg));

    if (lastMsg.type === 'ERROR') {
      // The error message should have the payload to retry stored in 'payload_to_retry'
      const errorData = lastMsg; // Assuming type ChatErrorMessage
      // console.log(
      //   "Payload data just before sending:",
      //   JSON.stringify(errorData.payload_to_retry, null, 2)
      // );

      const newPayload = {
        ...(errorData.payload_to_retry as Record<string, unknown>),
        llm_model: activeModel?.name,
      };
      sendChatMessage('retry', [], undefined, true, newPayload);
    } else {
      // console.log("No error found to retry.");
    }
  };

  return (
    <div
      className="mt-2 flex w-full items-center justify-between rounded border-[1px] border-red-500/40 px-2 py-2 text-sm"
      title="Error occurred"
    >
      <div className="flex items-center gap-2">
        <XCircle className="h-4 w-4 text-red-400" />
        <span className="text-red-400">An error occurred</span>
      </div>
      {retry && (
        <button
          className="rounded p-1 font-bold text-gray-300 hover:bg-gray-500"
          onClick={retryChat}
        >
          <RotateCw className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}
