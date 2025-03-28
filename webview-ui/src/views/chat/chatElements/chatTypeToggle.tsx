// file: webview-ui/src/views/chat/chatElements/chatTypeToggle.tsx
import {
  useChatSettingStore,
  useChatStore,
} from "@/stores/chatStore";

function ChatTypeToggle() {
  const {
    history: messages,
    isLoading,
  } = useChatStore();
  const { chatType, setChatType } = useChatSettingStore();

  return (
    <div className="w-18 flex h-4 items-center justify-between rounded-xl bg-[--deputydev-input-background]">
      <button
        className={`w-[50px] rounded-bl-xl rounded-tl-xl font-medium transition-all duration-200 ease-in-out ${
          chatType === "ask" ? "h-5 rounded-br-xl rounded-tr-xl bg-blue-500/70" : ""
        }`}
        onClick={() => {
          if (!isLoading) {
            setChatType("ask");
          }
        }}
        disabled={isLoading}
      >
        Chat
      </button>
      <button
        className={`w-[50px] rounded-br-xl rounded-tr-xl font-medium transition-all duration-200 ease-in-out ${
          chatType === "write" ? "h-5 rounded-bl-xl rounded-tl-xl bg-blue-500/70" : ""
        }`}
        onClick={() => {
          if (!isLoading) {
            setChatType("write");
          }
        }}
        disabled={isLoading}
      >
        Act
      </button>
    </div>
  );
}

export {ChatTypeToggle}