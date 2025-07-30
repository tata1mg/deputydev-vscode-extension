import { useThemeStore } from '@/stores/useThemeStore';
import { Sparkles, GitPullRequest } from 'lucide-react';
import useExtensionStore from '@/stores/useExtensionStore';
import { motion, AnimatePresence } from 'framer-motion';

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
  const activeColor = 'var(--deputydev-button-background)';

  return (
    <div
      className={`relative flex h-9 w-full items-center overflow-hidden rounded-full ${borderClass}`}
    >
      {/* Inactive Background Element */}
      <div
        className="absolute inset-y-1 left-0 right-0 rounded-full bg-[--deputydev-button-secondaryBackground]"
        aria-hidden="true"
      />

      {/* Sliding Indicator with Framer Motion */}
      <motion.div
        className={`absolute left-0 top-0 z-10 h-full w-1/2 rounded-full`}
        style={{ backgroundColor: activeColor }}
        initial={false}
        animate={{ x: isChat ? '0%' : '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        aria-hidden="true"
      />

      {/* Code Gen Tab */}
      <motion.button
        type="button"
        onClick={() => toggle(true)}
        className="relative z-20 flex h-full w-1/2 items-center justify-center gap-1 font-medium"
        style={{
          color: isChat
            ? 'var(--deputydev-button-foreground)'
            : 'var(--deputydev-button-secondaryForeground)',
        }}
        aria-pressed={isChat}
        whileTap={{ scale: 0.98 }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={isChat ? 'code-gen-active' : 'code-gen-inactive'}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className="flex items-center justify-center gap-1"
          >
            <Sparkles className="h-4 w-4" strokeWidth={2.5} />
            <span className="text-[0.9375rem]">Code Gen</span>
          </motion.div>
        </AnimatePresence>
      </motion.button>

      {/* Code Review Tab */}
      <motion.button
        type="button"
        onClick={() => toggle(false)}
        className="relative z-20 flex h-full w-1/2 items-center justify-center gap-1 font-medium"
        style={{
          color: !isChat
            ? 'var(--deputydev-button-foreground)'
            : 'var(--deputydev-button-secondaryForeground)',
        }}
        aria-pressed={!isChat}
        whileTap={{ scale: 0.98 }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={!isChat ? 'code-review-active' : 'code-review-inactive'}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className="flex items-center justify-center gap-1"
          >
            <GitPullRequest className="h-4 w-4" strokeWidth={2.5} />
            <span className="text-[0.9375rem]">Code Review</span>
          </motion.div>
        </AnimatePresence>
      </motion.button>
    </div>
  );
}

export { ViewSwitcher };
