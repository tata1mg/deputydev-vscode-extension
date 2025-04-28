// file: webview-ui/src/views/chat/chatElements/chatTypeToggle.tsx
import {
  useChatSettingStore,
  useChatStore,
} from "@/stores/chatStore";
import { useThemeStore } from "@/stores/useThemeStore";

function ChatTypeToggle() {
  const { isLoading } = useChatStore();
  const { chatType, setChatType } = useChatSettingStore();
  const { themeKind } = useThemeStore();

  const borderClass = (themeKind === "high-contrast" || themeKind === "high-contrast-light")
    ? "border border-[--deputydev-button-border]"
    : "";

  const activeBg = "bg-[--deputydev-button-background]";
  const activeFg = "text-[--deputydev-button-foreground]";
  const inactiveBg = "bg-[--deputydev-button-secondaryBackground]";
  const inactiveFg = "text-[--deputydev-button-secondaryForeground]";

  // Define the heights
  const activeHeightClass = "h-5"; // The taller height (e.g., 1.25rem)
  const inactiveHeightClass = "h-4"; // The shorter height (e.g., 1rem)
  // Calculate vertical offset for centering the inactive background
  // If h-5 is 1.25rem and h-4 is 1rem, difference is 0.25rem. Half is 0.125rem.
  // Tailwind's '0.5' unit is 0.125rem, so we use inset-y-0.5
  const inactiveVerticalInset = "inset-y-0.5"; // top: 0.125rem, bottom: 0.125rem

  return (
    // Container: Sets overall size (activeHeightClass), shape, and positioning context. No background.
    <div className={`relative flex w-[95px] ${activeHeightClass} items-center rounded-xl overflow-hidden`}>

      {/* Inactive Background Element: Smaller height, centered vertically */}
      <div
        className={`
          absolute ${inactiveVerticalInset} left-0 right-0 
          ${inactiveBg} 
          rounded-lg 
          ${borderClass} 
        `}
        aria-hidden="true"
      />

      {/* Sliding Indicator: Taller height (h-full of container), active background */}
      <div
        className={`
          absolute top-0 left-0 h-full w-1/2 
          ${activeBg} 
          rounded-xl 
          transition-transform duration-200 ease-in-out
          ${chatType === "ask" ? "translate-x-0" : "translate-x-full"}
          z-10 
          ${borderClass}
        `}
        aria-hidden="true"
      />

      {/* Option 1: Chat (Ask) - On top */}
      <button
        type="button"
        className={`
          relative z-20 flex h-full w-1/2 items-center justify-center 
          font-medium transition-colors duration-200 ease-in-out
          cursor-pointer 
          ${chatType === "ask" ? activeFg : inactiveFg}
        `}
        onClick={() => {
          if (!isLoading) {
            setChatType("ask");
          }
        }}
        disabled={isLoading || chatType === "ask"}
        aria-pressed={chatType === "ask"}
      >
        Chat
      </button>

      {/* Option 2: Act (Write) - On top */}
      <button
        type="button"
        className={`
          relative z-20 flex h-full w-1/2 items-center justify-center 
          font-medium transition-colors duration-200 ease-in-out
          cursor-pointer 
          ${chatType === "write" ? activeFg : inactiveFg}
        `}
        onClick={() => {
          if (!isLoading) {
            setChatType("write");
          }
        }}
        disabled={isLoading || chatType === "write"}
        aria-pressed={chatType === "write"}
      >
        Act
      </button>
    </div>
  );
}

export { ChatTypeToggle };