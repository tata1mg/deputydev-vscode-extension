import { useThemeStore } from '@/stores/useThemeStore';
import { MessageSquare, FileCode2 } from 'lucide-react';
import { motion } from 'framer-motion';
import useExtensionStore from '@/stores/useExtensionStore';

function ViewSwitcher() {
  const { themeKind } = useThemeStore();
  const { viewType } = useExtensionStore();

  // Determine if current view is chat
  const isChat = viewType === 'chat';

  const toggle = (nextIsChat: boolean) => {
    const currentIsChat = viewType === 'chat';
    if (nextIsChat === currentIsChat) return;

    // Update the store with the new view type
    useExtensionStore.setState({
      viewType: nextIsChat ? 'chat' : 'code-review',
    });
  };

  const borderClass =
    themeKind === 'high-contrast' || themeKind === 'high-contrast-light'
      ? 'border border-[--deputydev-button-border]'
      : '';
  const underlineColor = 'bg-[--deputydev-button-background]';

  const containerClass = `flex w-full h-9 items-center relative ${borderClass}`;

  return (
    <div className={containerClass}>
      {/* Sliding Underline */}
      <motion.div
        className={`absolute bottom-0 h-[2.5px] ${underlineColor}`}
        animate={{
          left: isChat ? '0%' : '50%',
          width: '50%', // Full width of each tab section
        }}
        transition={{
          type: 'spring',
          stiffness: 300,
          damping: 25,
        }}
      />

      {/* Code Gen Tab */}
      <button
        type="button"
        onClick={() => toggle(true)}
        className="relative box-border flex h-full flex-1 items-center justify-center gap-1 font-medium transition-opacity duration-200 ease-in-out"
        aria-pressed={isChat}
        style={{ opacity: isChat ? 1 : 0.7 }}
      >
        <div className="flex items-center justify-center gap-1">
          <MessageSquare className="h-4 w-4" strokeWidth={2.5} />
          <span className="text-[0.9375rem]">Code Gen</span>
        </div>
      </button>

      {/* Divider */}
      <div
        className="flex h-full items-center justify-center px-2 text-base"
        style={{ opacity: 0.5 }}
      >
        |
      </div>

      {/* Code Review Tab */}
      <button
        type="button"
        onClick={() => toggle(false)}
        className="relative box-border flex h-full flex-1 items-center justify-center gap-1 font-medium transition-opacity duration-200 ease-in-out"
        aria-pressed={!isChat}
        style={{ opacity: !isChat ? 1 : 0.7 }}
      >
        <div className="flex items-center justify-center gap-1">
          <FileCode2 className="h-4 w-4" strokeWidth={2.5} />
          <span className="text-[0.9375rem]">Code Review</span>
        </div>
      </button>
    </div>
  );
}

export { ViewSwitcher };
