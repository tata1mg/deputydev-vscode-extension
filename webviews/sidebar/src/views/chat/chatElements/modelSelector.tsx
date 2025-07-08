import * as Tooltip from '@radix-ui/react-tooltip';
import { useEffect, useRef, useState } from 'react';
import { Box, ChevronDown, Check } from 'lucide-react';
import { getWorkspaceState } from '@/commandApi';
import { useChatStore, useChatSettingStore } from '@/stores/chatStore';
import { motion, AnimatePresence } from 'framer-motion';

const ModelSelector = () => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { activeModel } = useChatSettingStore();
  const { llmModels } = useChatStore();

  useEffect(() => {
    const fetchConfigFromWorkspaceState = async () => {
      const essentialConfig = await getWorkspaceState({ key: 'essentialConfigData' });
      const llmModels = essentialConfig['LLM_MODELS'];
      if (llmModels.length !== 0) {
        useChatStore.setState({ llmModels: llmModels });
        if (useChatSettingStore.getState().activeModel === '') {
          useChatSettingStore.setState({ activeModel: llmModels[0]['name'] });
        }
      }
    };
    fetchConfigFromWorkspaceState();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (modelName: string) => {
    useChatSettingStore.setState({ activeModel: modelName });
    setIsOpen(false);
  };

  const selectedModel = llmModels.find((model) => model.name === activeModel);

  return (
    <div className="relative" ref={dropdownRef}>
      <Tooltip.Provider delayDuration={200}>
        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <motion.button
              onClick={() => setIsOpen(!isOpen)}
              className="flex items-center gap-1 rounded-full border border-[--vscode-commandCenter-inactiveBorder] px-1 py-0.5 text-xs hover:bg-[var(--deputydev-input-background)]"
              whileTap={{ scale: 0.98 }}
            >
              <motion.span
                animate={{ rotate: isOpen ? 360 : 0 }}
                transition={{ duration: 1, ease: 'easeInOut' }}
              >
                <Box className="h-3 w-3" />
              </motion.span>
              <div className="flex items-center gap-0.5">
                <span className="max-w-[80px] truncate text-xs">
                  {selectedModel?.display_name || 'Select Model'}
                </span>
                <motion.span animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                  <ChevronDown className="h-3 w-3 opacity-70" />
                </motion.span>
              </div>
            </motion.button>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content
              side="top"
              align="center"
              className="whitespace-nowrap rounded px-2 py-1 text-xs"
              style={{
                backgroundColor: 'var(--vscode-editorHoverWidget-background)',
                color: 'var(--vscode-editorHoverWidget-foreground)',
                border: '1px solid var(--vscode-editorHoverWidget-border)',
              }}
            >
              Choose Model
              <Tooltip.Arrow style={{ fill: 'var(--vscode-editorHoverWidget-background)' }} />
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>
      </Tooltip.Provider>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{
              type: 'spring',
              damping: 25,
              stiffness: 300,
              mass: 0.5,
            }}
            className="absolute bottom-full left-0 right-0 z-50 mx-auto mb-1 w-[120%] origin-bottom rounded-md border border-[--vscode-dropdown-border] bg-[--vscode-dropdown-background] shadow-lg"
          >
            <motion.div
              className="max-h-60 overflow-y-auto py-1"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
            >
              {llmModels.length > 0 ? (
                llmModels.map((model) => (
                  <motion.div
                    key={model.id}
                    whileHover={{ backgroundColor: 'var(--vscode-list-hoverBackground)' }}
                    className={`flex cursor-pointer items-center justify-between px-2 py-1 text-xs ${
                      activeModel === model.name
                        ? 'bg-[var(--vscode-list-activeSelectionBackground)]'
                        : ''
                    }`}
                    onClick={() => handleSelect(model.name)}
                  >
                    <span className="truncate">{model.display_name}</span>
                    {activeModel === model.name && <Check className="h-3 w-3" />}
                  </motion.div>
                ))
              ) : (
                <div className="px-2 py-1 text-xs text-gray-400">No models available</div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ModelSelector;
