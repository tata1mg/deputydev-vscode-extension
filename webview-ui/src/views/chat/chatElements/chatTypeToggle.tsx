// file: webview-ui/src/views/chat/chatElements/chatTypeToggle.tsx
import {
  useChatSettingStore,
  useChatStore,
} from "@/stores/chatStore";
import { useThemeStore } from "@/stores/useThemeStore";

function ChatTypeToggle() {
  const {
    history: messages,
    isLoading,
  } = useChatStore();
  const { chatType, setChatType } = useChatSettingStore();
  const { themeKind } = useThemeStore();
  const borderClass = (themeKind === "high-contrast" || themeKind === "high-contrast-light") ? "border border-[--deputydev-button-border]" : ""; 

  return (
    <div className={`w-18 flex h-4 items-center justify-between rounded-xl bg-[--deputydev-button-secondaryBackground] ${borderClass}` }>
      <button
        className={`w-[50px] rounded-bl-xl rounded-tl-xl font-medium transition-all  duration-200 ease-in-out ${
          chatType === "ask" ? "h-5 rounded-br-xl rounded-tr-xl bg-[--deputydev-button-background] text-[--deputydev-button-foreground] " + borderClass  : "text-[--deputydev-button-secondaryForeground]"
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
        className={`w-[50px] rounded-br-xl rounded-tr-xl font-medium transition-all  duration-200 ease-in-out ${
          chatType === "write" ? "h-5 rounded-bl-xl rounded-tl-xl bg-[--deputydev-button-background] text-[--deputydev-button-foreground] " + borderClass  : "text-[--deputydev-button-secondaryForeground]"
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